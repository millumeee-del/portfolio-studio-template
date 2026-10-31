import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loadCharacterFace } from './character-face.js';
import { mountCharacterCable } from './character-cable.js';
import {loadSharedCharacterAnimation} from './character-animation.js';
import { GAZE_SETTINGS, pointerGaze } from './character-gaze.js';
import { MOTION, motionAt, phaseForAngle, clamp, smoothstep, wrapDegrees } from './character-motion.js';

// Body angles are TOTAL world-space offsets, including the parent chain.
// The head and neck use absolute gaze targets configured in character-gaze.js.
const BONE_RESPONSE = {
  Hips: [.6,.25,.2], Spine: [1,.5,.35], Spine1: [1.7,1,.5], Spine2: [2.7,1.5,.7],
  Shoulder: [3.2,1.8,1.1], Arm: [2,1.4,1.1], ForeArm: [1.3,1,.8],
  Hand: [1,.7,.6], Finger: [.65,.45,.35],
  UpLeg: [.3,.2,.15], Leg: [.25,.16,.12], Foot: [.15,.1,.07], ToeBase: [.1,.07,.05]
};
const SETTINGS = {
  releaseDelay: 1.2,
  returnSeconds: 1.1,
  dragDegreesPerPixel: .22,
  framing: 1.15,
  fieldOfView: 30,
  polarAngle: 85,
  animationCycleSeconds: 404 / 24,
  maxFrameSeconds: 1 / 30
};
const rad=THREE.MathUtils.degToRad, deg=THREE.MathUtils.radToDeg;
const Z=new THREE.Vector3(0,0,1);

function boneResponse(name) {
  const short=name.replace(/^mixamorig[:_]?/i,'').replace(/^(Left|Right)/,'');
  if (/End$/.test(short)) return null;
  if(short==='Head'||short==='Neck')return [0,0,0];
  if (/Hand(Thumb|Index|Middle|Ring|Pinky)/.test(short)) return BONE_RESPONSE.Finger;
  return BONE_RESPONSE[short] ?? null;
}

function depth(node) {let result=0;while(node.parent){result++;node=node.parent;}return result;}

// 用身体和头发确定站位，背包、裙摆等配件不参与重新居中和缩放。
// 缺少命名身体的其他模型仍可使用完整网格取景。
function measureModel(root) {
  root.updateMatrixWorld(true);
  root.traverse(n=>{if(n.isSkinnedMesh)n.skeleton.update();});
  const box=new THREE.Box3(), vertex=new THREE.Vector3();
  const meshes=[],body=root.getObjectByName('body'),hair=root.getObjectByName('hair');
  const references=body?[body,...(hair?[hair]:[])]:[root];
  for(const reference of references)reference.traverse(n=>{if(n.isMesh&&n.geometry.attributes.position&&!meshes.includes(n))meshes.push(n);});
  for(const mesh of meshes){
    for(let i=0;i<mesh.geometry.attributes.position.count;i++){
      mesh.getVertexPosition(i,vertex);vertex.applyMatrix4(mesh.matrixWorld);box.expandByPoint(vertex);
    }
  }
  const center=box.getCenter(new THREE.Vector3());
  const hips=root.getObjectByName('mixamorigHips')??root.getObjectByName('mixamorig:Hips');
  if(body&&hips){const anchor=hips.getWorldPosition(new THREE.Vector3());center.x=anchor.x;center.z=anchor.z;}
  let radiusSquared=0,horizontalRadius=0;
  for(const mesh of meshes){
    for(let i=0;i<mesh.geometry.attributes.position.count;i++){
      mesh.getVertexPosition(i,vertex);vertex.applyMatrix4(mesh.matrixWorld);
      radiusSquared=Math.max(radiusSquared,center.distanceToSquared(vertex));
      horizontalRadius=Math.max(horizontalRadius,Math.hypot(vertex.x-center.x,vertex.z-center.z));
    }
  }
  return {box,center,size:box.getSize(new THREE.Vector3()),radius:Math.sqrt(radiusSquared),horizontalRadius};
}

function disposeModel(root) {
  const geometry=new Set(),materials=new Set(),textures=new Set();
  root.traverse(n=>{if(n.geometry)geometry.add(n.geometry);for(const m of(Array.isArray(n.material)?n.material:n.material?[n.material]:[])){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});
  geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>{t.source?.data?.close?.();t.dispose();});
}

export function mountCharacter(host,{holdMotion=false,getState,onReady,onError}={}) {
  const status=host.querySelector('.character-status');
  // 固定本次加载的配置，快速切换时不读取另一请求刚写入的属性。
  const modelSrc=host.dataset.modelSrc,requestedAnimation=host.dataset.animationName,faceDirectory=host.dataset.faceDirectory,faceTexturePrefix=host.dataset.faceTexturePrefix||'face';
  const faceTextureFiles=JSON.parse(host.dataset.faceTextures||'null');
  const animationUrl=host.dataset.animationUrl;
  let renderer,model,mixer,action,face,cable,animationName='',animationDuration=0,ready=false,disposed=false,inheritedState=false;
  const faceAbort=new AbortController();
  let animationTime=0,phase=phaseForAngle(0),yaw=0,mode='auto',clock=0,lastTimestamp=0;
  let dragging=false,pointerId=null,startX=0,startY=0,startYaw=0,dragMoved=false;
  let releaseAt=0,returnFrom=0,returnTo=0,returnStart=0,resumeAt=0;
  let pointerPresent=false,pointerInside=false,hasPointerPosition=false,pointerX=0,pointerY=0,smoothedX=0,smoothedY=0,feedback=0;
  let headScreenX=0,headScreenY=0,faceWidthPixels=60,gazeDistance=0,gazeProximity=0,gazeStrength=0,gazeRadius=0;
  let eyeScreenX=0,eyeScreenY=0;
  let headEntry,faceMesh;
  let intersecting=true,hidden=document.hidden,baseDistance=1,horizontalRadius=0,framingRadius=1,loadedHeight=0;
  const entries=[],listeners=[];
  const scene=new THREE.Scene(), turntable=new THREE.Group(), wrapper=new THREE.Group();
  turntable.add(wrapper);scene.add(turntable);
  const camera=new THREE.PerspectiveCamera(SETTINGS.fieldOfView,1,.01,100);
  const target=new THREE.Vector3(), headPosition=new THREE.Vector3(), projectedHead=new THREE.Vector3();
  const cameraRight=new THREE.Vector3(), cameraUp=new THREE.Vector3(),cameraBack=new THREE.Vector3();
  const faceAnchor=new THREE.Vector3(),faceWidthPoint=new THREE.Vector3(),projectedWidthPoint=new THREE.Vector3();
  const neutralForward=new THREE.Vector3(),headScale=new THREE.Vector3(),neutralFaceMatrix=new THREE.Matrix4();
  const neutralHeadQuaternion=new THREE.Quaternion();
  const baseForward=new THREE.Vector3(),desiredForward=new THREE.Vector3();
  const qYaw=new THREE.Quaternion(),qPitch=new THREE.Quaternion(),qRoll=new THREE.Quaternion(),qDelta=new THREE.Quaternion();
  const qIdentity=new THREE.Quaternion();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');let reduceMotion=reduced.matches;
  const pointerCapable=matchMedia('(any-hover: hover) and (any-pointer: fine)');
  const on=(element,event,listener,options)=>{element.addEventListener(event,listener,options);listeners.push(()=>element.removeEventListener(event,listener,options));};
  let environmentTarget,environmentScene,pmrem,resizeObserver,intersectionObserver,shadowTexture;
  const footShadows=[];
  let motionEnabled=!holdMotion,motionStart=-Infinity,revealFrame;
  let renderWidth=0,renderHeight=0,renderRatio=0;

  function startMotion() {
    if(motionEnabled||disposed)return;
    motionEnabled=true;motionStart=inheritedState?-Infinity:performance.now();lastTimestamp=0;
  }

  function stopPointer() {pointerPresent=false;}
  function trackPointer(event) {
    if(event.pointerType==='touch')return;
    pointerPresent=true;pointerInside=true;hasPointerPosition=true;
    pointerX=event.clientX;pointerY=event.clientY;
  }
  function restorePointer() {pointerPresent=pointerInside&&hasPointerPosition;}
  function beginReturn() {
    mode='return';returnStart=clock;returnFrom=wrapDegrees(yaw);
    returnTo=reduceMotion?0:clamp(returnFrom,-MOTION.limit,MOTION.limit);
    yaw=returnFrom;
  }
  function releasePointer(event) {
    if(pointerId===null||(event?.pointerId!==undefined&&event.pointerId!==pointerId))return;
    const captured=pointerId,wasDragging=dragging;
    pointerId=null;dragging=false;
    if(renderer?.domElement.hasPointerCapture(captured))renderer.domElement.releasePointerCapture(captured);
    if(wasDragging){mode='wait';releaseAt=clock+SETTINGS.releaseDelay;}
    host.classList.remove('is-dragging');
  }
  function manualTurn(amount) {
    yaw=wrapDegrees(yaw+amount);mode='wait';releaseAt=clock+SETTINGS.releaseDelay;
  }
  function resize() {
    if(!renderer)return;
    const width=Math.max(host.clientWidth,1),height=Math.max(host.clientHeight,1);
    const ratio=Math.min(devicePixelRatio,2);
    // 重设相同尺寸也会清空 WebGL 缓冲区；只在实际尺寸变化时更新。
    if(ratio!==renderRatio)renderer.setPixelRatio(ratio);
    if(width!==renderWidth||height!==renderHeight||ratio!==renderRatio)renderer.setSize(width,height);
    renderWidth=width;renderHeight=height;renderRatio=ratio;
    camera.aspect=width/height;
    const distance=Math.max(baseDistance,horizontalRadius/(Math.tan(rad(SETTINGS.fieldOfView/2))*camera.aspect)*1.25);
    // Keep depth precision high for clothing surfaces close to the body mesh.
    camera.near=Math.max(.02,distance-framingRadius*2);
    camera.far=distance+framingRadius*3;
    const phi=rad(SETTINGS.polarAngle);
    camera.position.set(0,target.y+distance*Math.cos(phi),distance*Math.sin(phi));
    camera.lookAt(target);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  }

  function updateRotation(dt) {
    if(dragging)return;
    if(mode==='wait'&&clock>=releaseAt)beginReturn();
    if(mode==='return'){
      const progress=clamp((clock-returnStart)/SETTINGS.returnSeconds,0,1);
      yaw=THREE.MathUtils.lerp(returnFrom,returnTo,smoothstep(progress));
      if(progress>=1){phase=phaseForAngle(returnTo,returnTo>=0?-1:1);resumeAt=clock;mode='auto';}
    }else if(mode==='auto'){
      if(reduceMotion){yaw=0;return;}
      phase+=dt*smoothstep((clock-resumeAt)/.45);yaw=motionAt(phase).angle;
    }
  }

  function updateBones(dt) {
    // Restore last frame's authored pose even for bones without animation tracks.
    for(const entry of entries)entry.bone.quaternion.copy(entry.baseLocal);
    mixer?.update(dt);animationTime=mixer?.time??0;
    turntable.updateMatrixWorld(true);
    for(const entry of entries){entry.baseLocal.copy(entry.bone.quaternion);entry.bone.getWorldQuaternion(entry.baseWorld);}

    cameraRight.setFromMatrixColumn(camera.matrixWorld,0);cameraUp.setFromMatrixColumn(camera.matrixWorld,1);cameraBack.setFromMatrixColumn(camera.matrixWorld,2);
    // The zero-pitch line is the eyes in a level pose, rather than the face's
    // bounding-box center or the idle animation's tilted head. Use horizontal
    // gaze only, so looking up/down cannot drag its own neutral line with it.
    if(faceMesh&&headEntry){
      const horizontal=rad(smoothedX*Math.max(0,GAZE_SETTINGS.maxYaw));
      neutralForward.copy(cameraBack).multiplyScalar(Math.cos(horizontal))
        .addScaledVector(cameraRight,Math.sin(horizontal)).normalize();
      baseForward.copy(headEntry.forwardLocal).applyQuaternion(headEntry.baseWorld).normalize();
      neutralHeadQuaternion.setFromUnitVectors(baseForward,neutralForward).multiply(headEntry.baseWorld);
      headEntry.bone.getWorldPosition(headPosition);headEntry.bone.getWorldScale(headScale);
      neutralFaceMatrix.compose(headPosition,neutralHeadQuaternion,headScale).multiply(faceMesh.matrix);
      headPosition.copy(faceAnchor).applyMatrix4(neutralFaceMatrix);
      projectedWidthPoint.copy(faceWidthPoint).applyMatrix4(neutralFaceMatrix).project(camera);
    }else if(headEntry)headEntry.bone.getWorldPosition(headPosition);
    else headPosition.set(0,loadedHeight*.86,0);
    projectedHead.copy(headPosition).project(camera);
    const rect=host.getBoundingClientRect();
    headScreenX=rect.left+(projectedHead.x+1)*rect.width/2;
    headScreenY=rect.top+(1-projectedHead.y)*rect.height/2;
    if(faceMesh)faceWidthPixels=Math.max(36,Math.abs(projectedWidthPoint.x-projectedHead.x)*rect.width);
    const active=pointerPresent&&pointerCapable.matches&&!reduceMotion&&!dragging;
    const input=pointerGaze(pointerX-headScreenX,headScreenY-pointerY,faceWidthPixels,{width:innerWidth,height:innerHeight});
    gazeDistance=input.distance;gazeProximity=input.proximity;gazeStrength=input.strength;gazeRadius=input.radius;
    const tx=active&&GAZE_SETTINGS.maxYaw>0?input.yaw/GAZE_SETTINGS.maxYaw:0;
    const ty=active&&GAZE_SETTINGS.maxPitch>0?input.pitch/GAZE_SETTINGS.maxPitch:0;
    const damping=1-Math.exp(-dt/Math.max(.001,GAZE_SETTINGS.responseSeconds));
    smoothedX+=damping*(tx-smoothedX);smoothedY+=damping*(ty-smoothedY);
    feedback+=(1-Math.exp(-dt/.12))*((active?1:0)-feedback);

    const desiredYaw=rad(smoothedX*Math.max(0,GAZE_SETTINGS.maxYaw)),desiredPitch=rad(smoothedY*Math.max(0,GAZE_SETTINGS.maxPitch));
    desiredForward.copy(cameraBack).multiplyScalar(Math.cos(desiredPitch)*Math.cos(desiredYaw))
      .addScaledVector(cameraRight,Math.cos(desiredPitch)*Math.sin(desiredYaw))
      .addScaledVector(cameraUp,Math.sin(desiredPitch)).normalize();
    // Fade gaze for manual rear views, where looking through the body would
    // require an unnatural neck twist. The automatic +/-15-degree range is full strength.
    const facing=headEntry?baseForward.copy(headEntry.forwardLocal).applyQuaternion(headEntry.baseWorld).dot(cameraBack):1;
    const frontWeight=smoothstep((facing-Math.cos(rad(85)))/(Math.cos(rad(55))-Math.cos(rad(85))));

    // Parent-first world targets give each bone its own total angular budget.
    for(const entry of entries){
      const [yawLimit,pitchLimit,rollLimit]=entry.response;
      if(entry.gazeShare){
        // Solve the absolute screen-facing direction from this frame's actual
        // authored pose, then convert the world target into the parent's space.
        // The correction can exceed 15 degrees to counter the body's turn.
        baseForward.copy(entry.forwardLocal).applyQuaternion(entry.baseWorld).normalize();
        qDelta.setFromUnitVectors(baseForward,desiredForward);
        const correction=deg(qDelta.angleTo(qIdentity));
        const safety=correction>GAZE_SETTINGS.headCorrectionLimit?GAZE_SETTINGS.headCorrectionLimit/correction:1;
        qDelta.slerp(qIdentity,1-feedback*frontWeight*entry.gazeShare*safety);
      }else{
        const localYaw=smoothedX*yawLimit*feedback;
        const localPitch=smoothedY*pitchLimit*feedback;
        qYaw.setFromAxisAngle(cameraUp,rad(localYaw));
        qPitch.setFromAxisAngle(cameraRight,-rad(localPitch));
        qRoll.setFromAxisAngle(Z,-rad(smoothedX*rollLimit*feedback));
        qDelta.copy(qYaw).multiply(qPitch).multiply(qRoll);
      }
      entry.targetWorld.copy(qDelta).multiply(entry.baseWorld);
      entry.bone.parent.getWorldQuaternion(entry.parentInverse).invert();
      entry.bone.quaternion.copy(entry.parentInverse).multiply(entry.targetWorld).normalize();
      entry.bone.updateMatrixWorld(true);
    }
    if(faceMesh){
      projectedHead.copy(faceAnchor);faceMesh.localToWorld(projectedHead);projectedHead.project(camera);
      eyeScreenX=rect.left+(projectedHead.x+1)*rect.width/2;
      eyeScreenY=rect.top+(1-projectedHead.y)*rect.height/2;
    }
  }

  function frame(timestamp) {
    // 新模型编译材质可能占用一帧；恢复后缓缓继续，不追赶整段卡顿时间。
    const elapsed=lastTimestamp?Math.min((timestamp-lastTimestamp)/1000,SETTINGS.maxFrameSeconds):0;lastTimestamp=timestamp;
    if(disposed||!ready||hidden||!intersecting)return;
    const dt=motionEnabled?elapsed*smoothstep((timestamp-motionStart)/500):0;
    clock+=dt;updateRotation(dt);turntable.rotation.y=rad(yaw);updateBones(dt);face?.update(clock,reduceMotion);cable?.update();
    for(const shadow of footShadows){
      shadow.bone.getWorldPosition(shadow.position);
      shadow.mesh.position.set(shadow.position.x,.001,shadow.position.z);
      shadow.mesh.rotation.z=rad(-yaw);
      shadow.mesh.material.opacity=.13*Math.exp(-Math.max(0,shadow.position.y-shadow.restY)*8);
    }
    renderer.render(scene,camera);
  }

  function captureFrame(){renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png');}
  const debug={captureFrame,snapshot(){
    return {ready,modelUrl:modelSrc,animationName,animationTime,animationDuration,animationPhase:action&&animationDuration>0?action.time/animationDuration:0,animationCycleSeconds:SETTINGS.animationCycleSeconds,yaw,phase,clock,mode,dragging,feedback,motionEnabled,face:face?.snapshot(),cable:cable?.snapshot(),
      framing:{scale:wrapper.scale.x,offset:wrapper.position.toArray(),height:loadedHeight,baseDistance,horizontalDistance:horizontalRadius/Math.tan(rad(SETTINGS.fieldOfView/2))*1.25},
      rotation:{releaseAt,returnFrom,returnTo,returnStart,resumeAt},
      pointer:{present:pointerPresent,inside:pointerInside,hasPosition:hasPointerPosition,x:pointerX,y:pointerY},
      mouse:[smoothedX,smoothedY],headScreen:[headScreenX,headScreenY],eyeScreen:[eyeScreenX,eyeScreenY],cameraDistance:camera.position.distanceTo(target),fov:camera.fov,clip:[camera.near,camera.far],
      gaze:{targetYaw:smoothedX*Math.max(0,GAZE_SETTINGS.maxYaw),targetPitch:smoothedY*Math.max(0,GAZE_SETTINGS.maxPitch),faceWidthPixels,distance:gazeDistance,proximity:gazeProximity,strength:gazeStrength,radius:gazeRadius},
      limit:MOTION.limit,speed:MOTION.speed,easeBand:MOTION.easeBand,reduceMotion,
      bones:entries.map(e=>{
        const final=e.bone.getWorldQuaternion(new THREE.Quaternion());
        const direction=e.forwardLocal.clone().applyQuaternion(final);
        const position=e.bone.getWorldPosition(new THREE.Vector3()),screen=position.clone().project(camera);
        return {name:e.bone.name,position:position.toArray(),screen:screen.toArray(),offsetDegrees:deg(final.angleTo(e.baseWorld)),base:e.baseWorld.toArray(),final:final.toArray(),
          facingYaw:deg(Math.atan2(direction.dot(cameraRight),direction.dot(cameraBack))),
          facingPitch:deg(Math.atan2(direction.dot(cameraUp),Math.hypot(direction.dot(cameraRight),direction.dot(cameraBack))))};
      })};
  }};

  function inheritState(previous) {
    if(!previous?.ready)return;
    inheritedState=true;
    yaw=previous.yaw;phase=previous.phase;clock=previous.clock;
    smoothedX=previous.mouse[0];smoothedY=previous.mouse[1];feedback=previous.feedback;
    if(previous.pointer){
      pointerPresent=previous.pointer.present;pointerInside=previous.pointer.inside;hasPointerPosition=previous.pointer.hasPosition;
      pointerX=previous.pointer.x;pointerY=previous.pointer.y;
    }
    mode=['auto','wait','return'].includes(previous.mode)?previous.mode:'wait';
    if(previous.rotation)({releaseAt,returnFrom,returnTo,returnStart,resumeAt}=previous.rotation);
    if(previous.mode==='drag'||!previous.rotation)releaseAt=clock+SETTINGS.releaseDelay;
    // 每个 GLB 的片段长度不同，但播放时间统一映射到同一个动作周期。
    if(mixer&&action){
      const previousPhase=Number.isFinite(previous.animationPhase)?previous.animationPhase:0;
      mixer.setTime(0);action.time=((previousPhase%1)+1)%1*animationDuration;mixer.update(0);animationTime=mixer.time;
    }
    for(const entry of entries)entry.baseLocal.copy(entry.bone.quaternion);
  }

  try {
    renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NeutralToneMapping;renderer.toneMappingExposure=1.4;
    renderer.domElement.setAttribute('aria-hidden','true');host.append(renderer.domElement);
    Object.assign(renderer.domElement.style,{position:'absolute',inset:'0',visibility:'hidden'});
    pmrem=new THREE.PMREMGenerator(renderer);environmentScene=new RoomEnvironment();
    environmentTarget=pmrem.fromScene(environmentScene,.04);scene.environment=environmentTarget.texture;
    environmentScene.dispose();environmentScene=null;pmrem.dispose();pmrem=null;
    scene.add(new THREE.HemisphereLight(0xffffff,0x8b8b81,2));
    const key=new THREE.DirectionalLight(0xffffff,2);key.position.set(-3,7,5);scene.add(key);
    // Soft contact shadows preserve the previous page's neutral floor appearance.
    const shadowCanvas=document.createElement('canvas');shadowCanvas.width=128;shadowCanvas.height=128;
    const context=shadowCanvas.getContext('2d');
    const gradient=context.createRadialGradient(64,64,0,64,64,64);
    gradient.addColorStop(0,'rgba(0,0,0,1)');gradient.addColorStop(.4,'rgba(0,0,0,.45)');gradient.addColorStop(1,'rgba(0,0,0,0)');
    context.fillStyle=gradient;context.fillRect(0,0,128,128);shadowTexture=new THREE.CanvasTexture(shadowCanvas);
    const makeShadow=(width,length,opacity)=>{
      const shadow=new THREE.Mesh(new THREE.PlaneGeometry(width,length),new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,opacity,depthWrite:false,toneMapped:false}));
      shadow.rotation.x=-Math.PI/2;shadow.position.y=0;shadow.renderOrder=-1;scene.add(shadow);return shadow;
    };
    const bodyShadow=makeShadow(.9,.6,.055);

    const canvas=renderer.domElement;
    on(window,'pointermove',trackPointer,{passive:true,capture:true});
    on(document.documentElement,'pointerenter',trackPointer,{passive:true});
    on(canvas,'pointerdown',event=>{
      if(event.button!==0||pointerId!==null)return;
      pointerId=event.pointerId;startX=event.clientX;startY=event.clientY;startYaw=yaw;
      dragMoved=false;canvas.setPointerCapture(pointerId);trackPointer(event);
      if(event.pointerType!=='touch'){host.focus({preventScroll:true});event.preventDefault();}
    });
    on(canvas,'pointermove',event=>{
      if(event.pointerId!==pointerId)return;
      const dx=event.clientX-startX,dy=event.clientY-startY;
      if(event.pointerType==='touch'&&!dragMoved&&Math.abs(dy)>Math.abs(dx)+6){releasePointer(event);return;}
      if(!dragMoved&&Math.abs(dx)>3){dragMoved=true;dragging=true;startYaw=yaw;mode='drag';host.classList.add('is-dragging');}
      if(dragMoved)yaw=wrapDegrees(startYaw+dx*SETTINGS.dragDegreesPerPixel);
    });
    on(canvas,'pointerup',releasePointer);on(canvas,'pointercancel',releasePointer);on(canvas,'lostpointercapture',releasePointer);
    on(host,'keydown',event=>{
      if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();manualTurn(event.key==='ArrowRight'?5:-5);}
      else if(event.key==='Escape'){pointerPresent=false;releasePointer();beginReturn();}
    });
    on(document.documentElement,'pointerleave',()=>{pointerInside=false;stopPointer();});
    on(window,'blur',()=>{stopPointer();releasePointer();});
    on(window,'focus',restorePointer);
    on(document,'visibilitychange',()=>{hidden=document.hidden;lastTimestamp=0;if(hidden){stopPointer();releasePointer();}else restorePointer();});
    on(reduced,'change',()=>{reduceMotion=reduced.matches;stopPointer();if(!dragging)beginReturn();});
    on(canvas,'webglcontextlost',event=>{event.preventDefault();status.hidden=false;status.textContent='3D 显示中断，请刷新页面恢复。';renderer.setAnimationLoop(null);});
    resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);
    intersectionObserver=new IntersectionObserver(items=>{intersecting=items[0].isIntersecting;lastTimestamp=0;},{rootMargin:'100px'});intersectionObserver.observe(host);
    on(window,'resize',resize,{passive:true});resize();renderer.setAnimationLoop(frame);
    new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(modelSrc).then(async gltf=>{
      if(disposed){disposeModel(gltf.scene);return;}
      model=gltf.scene;const bounds=measureModel(model);
      if(!Number.isFinite(bounds.size.y)||bounds.size.y<=0)throw new Error('Empty character model');
      const scale=2.8/bounds.size.y;
      wrapper.scale.setScalar(scale);wrapper.position.set(-bounds.center.x*scale,-bounds.box.min.y*scale,-bounds.center.z*scale);wrapper.add(model);
      loadedHeight=bounds.size.y*scale;target.set(0,loadedHeight/2,0);
      framingRadius=bounds.radius*scale;
      baseDistance=framingRadius/Math.sin(rad(SETTINGS.fieldOfView/2))*SETTINGS.framing;
      horizontalRadius=bounds.horizontalRadius*scale;
      model.traverse(node=>{
        if(node.isMesh){node.castShadow=true;node.receiveShadow=true;}
        const response=node.isBone?boneResponse(node.name):null;
        if(response)entries.push({bone:node,response,baseLocal:node.quaternion.clone(),baseWorld:new THREE.Quaternion(),targetWorld:new THREE.Quaternion(),parentInverse:new THREE.Quaternion()});
      });
      entries.sort((a,b)=>depth(a.bone)-depth(b.bone));
      // Calibrate each bone's neutral forward axis from the GLB rest pose.
      // Bone local +Z is not a reliable face direction in an imported rig.
      turntable.updateMatrixWorld(true);
      for(const entry of entries){
        entry.bone.getWorldQuaternion(entry.baseWorld);
        entry.forwardLocal=Z.clone().applyQuaternion(entry.baseWorld.clone().invert());
        entry.gazeShare=/Head$/.test(entry.bone.name)?1:/Neck$/.test(entry.bone.name)?GAZE_SETTINGS.neckShare:0;
      }
      headEntry=entries.find(e=>/Head$/.test(e.bone.name));
      const shared=await loadSharedCharacterAnimation(animationUrl);
      if(disposed)return;
      const clip=shared??gltf.animations.find(a=>a.name===requestedAnimation)??gltf.animations[0];
      if(clip){
        animationName=clip.name;animationDuration=clip.duration;mixer=new THREE.AnimationMixer(model);
        action=mixer.clipAction(clip);
        action.setEffectiveTimeScale(animationDuration>0?animationDuration/SETTINGS.animationCycleSeconds:1).play();mixer.update(0);
      }
      for(const entry of entries)entry.baseLocal.copy(entry.bone.quaternion);
      turntable.updateMatrixWorld(true);
      for(const entry of entries.filter(e=>/Foot$/.test(e.bone.name))){
        const position=entry.bone.getWorldPosition(new THREE.Vector3());
        footShadows.push({bone:entry.bone,mesh:makeShadow(.38,.45,.13),position,restY:position.y});
      }
      bodyShadow.position.z=.05;
      cable=mountCharacterCable(model,bounds.size.y);
      if(faceDirectory !== 'none') try {
        face=await loadCharacterFace(model,{directory:faceDirectory??'/models/face',texturePrefix:faceTexturePrefix,textureFiles:faceTextureFiles,revision:new URL(modelSrc,location.href).searchParams.get('v')||'',signal:faceAbort.signal});
        if(disposed){face.dispose();return;}
        // Upload both frames before starting, so the first blink cannot stall.
        face.textures.forEach(texture=>renderer.initTexture(texture));
        faceMesh=model.getObjectByName('character-face-overlay');
        if(faceMesh){
          faceMesh.geometry.computeBoundingBox();
          const bounds=faceMesh.geometry.boundingBox,size=bounds.getSize(new THREE.Vector3());
          bounds.getCenter(faceAnchor);
          // Calibrated against the eye pixels in face_02.png and the face UVs.
          faceAnchor.y=bounds.min.y+size.y*clamp(GAZE_SETTINGS.eyeLineHeight,0,1);
          faceAnchor.z=bounds.min.z+size.z*.8;
          faceWidthPoint.copy(faceAnchor);faceWidthPoint.x+=size.x/2;
        }
      }catch(error){
        if(disposed)return;
        console.error('Face expressions could not be loaded:',error);
      }
      inheritState(getState?.());
      resize();ready=true;lastTimestamp=0;
      renderer.compile(scene,camera);
      // 起点固定为动画 0 秒；不把资源加载时间计入第一帧。
      frame(performance.now());
      let warmFrames=1;
      function reveal(){
        if(disposed)return;
        if(warmFrames-->0){frame(performance.now());revealFrame=requestAnimationFrame(reveal);return;}
        // 编译、预热期间旧人物还在动，显示前再次取得它的最新动作和朝向。
        inheritState(getState?.());lastTimestamp=0;frame(performance.now());
        renderer.domElement.style.visibility='';status.hidden=true;
        if(import.meta.env.DEV)host.__characterInteraction=debug;
        onReady?.({startMotion,captureFrame,getState:debug.snapshot});
        host.dispatchEvent(new CustomEvent('character-ready'));
      }
      revealFrame=requestAnimationFrame(reveal);
    }).catch(error=>{
      if(disposed)return;
      status.hidden=false;status.textContent='人物加载失败，请检查 GLB 文件后刷新。';console.error(error);
      onError?.(error);
    });
  } catch(error) {
    status.hidden=false;status.textContent='3D 显示无法启动，请使用支持 WebGL 的浏览器。';console.error(error);
    onError?.(error);
  }

  return function dispose() {
    if(disposed)return;disposed=true;
    cancelAnimationFrame(revealFrame);
    renderer?.setAnimationLoop(null);listeners.forEach(remove=>remove());resizeObserver?.disconnect();intersectionObserver?.disconnect();
    faceAbort.abort();face?.dispose();cable?.dispose();
    mixer?.stopAllAction();if(model)mixer?.uncacheRoot(model);
    if(model)disposeModel(model);
    scene.traverse(n=>{if(n.isLight)n.dispose?.();if(n.isMesh&&!model?.getObjectById(n.id)){n.geometry?.dispose();n.material?.dispose();}});
    shadowTexture?.dispose();environmentTarget?.dispose();environmentScene?.dispose();pmrem?.dispose();renderer?.dispose();renderer?.forceContextLoss();renderer?.domElement.remove();
    if(host.__characterInteraction===debug)delete host.__characterInteraction;
  };
}
