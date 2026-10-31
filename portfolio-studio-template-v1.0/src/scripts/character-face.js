import * as THREE from 'three';

export const FACE_SETTINGS=Object.freeze({
  interval:3,
  duration:.15,
  forwardOffset:.35, // 沿头部局部 +Z 向前微移，约为脸宽的 0.4%；三个模型共用。
});

export async function loadCharacterFace(model,{directory='/models/face',texturePrefix='face',textureFiles,revision='',signal}={}) {
  const bone=model.getObjectByName('mixamorigHead')??model.getObjectByName('mixamorig:Head');
  if(!bone)throw new Error('Face overlay requires the character head bone');
  const asset=filename=>`${filename.startsWith('/')?filename:directory+'/'+filename}${revision?'?v='+encodeURIComponent(revision):''}`;
  const response=await fetch(asset('face-overlay.json'),{signal});
  if(!response.ok)throw new Error(`Face geometry: HTTP ${response.status}`);
  const data=await response.json();
  if(!Array.isArray(data.positions)||data.positions.length%9||data.uv?.length!==data.positions.length/3*2)
    throw new Error('Invalid face overlay geometry');
  const loader=new THREE.TextureLoader();
  const files=textureFiles??['02','01'].map(name=>`${texturePrefix}_${name}.png`);
  const results=await Promise.allSettled(files.map(file=>loader.loadAsync(asset(file))));
  const textures=results.filter(r=>r.status==='fulfilled').map(r=>r.value);
  if(signal?.aborted||results.some(r=>r.status==='rejected')){
    textures.forEach(t=>t.dispose());
    throw signal?.reason??results.find(r=>r.status==='rejected')?.reason;
  }
  for(const texture of textures){texture.flipY=false;texture.colorSpace=THREE.SRGBColorSpace;}
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(data.uv,2));
  const material=new THREE.MeshBasicMaterial({
    map:textures[0],transparent:true,alphaTest:.02,depthWrite:false,toneMapped:false,
    polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2
  });
  const mesh=new THREE.Mesh(geometry,material);mesh.name='character-face-overlay';
  mesh.position.z=FACE_SETTINGS.forwardOffset;
  mesh.renderOrder=1;bone.add(mesh);
  // 新模型使用重新导出的脸部几何；隐藏自带表情，避免眨眼时底下仍透出睁眼图。
  const sourceMesh=data.sourceMesh&&(model.getObjectByName(data.sourceMesh)??model.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(data.sourceMesh)));
  const sourceVisible=sourceMesh?.visible;
  if(sourceMesh)sourceMesh.visible=false;
  let expression='02',blinkCount=0,disposed=false;
  return {
    textures,
    update(time,reducedMotion=false){
      if(disposed)return;
      const closed=!reducedMotion&&time>=FACE_SETTINGS.interval&&time%FACE_SETTINGS.interval<FACE_SETTINGS.duration;
      const next=closed?'01':'02';
      if(next!==expression){if(closed)blinkCount++;expression=next;material.map=textures[closed?1:0];}
    },
    snapshot(){return {ready:!disposed,expression,blinkCount,directory,texturePrefix,textureFiles:files,interval:FACE_SETTINGS.interval,duration:FACE_SETTINGS.duration};},
    dispose(){if(disposed)return;disposed=true;if(sourceMesh)sourceMesh.visible=sourceVisible;mesh.removeFromParent();geometry.dispose();material.dispose();textures.forEach(t=>t.dispose());}
  };
}
