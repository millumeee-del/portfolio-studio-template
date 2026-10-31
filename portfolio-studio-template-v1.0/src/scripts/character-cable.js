import * as THREE from 'three';

// 两端由接口位置与法线约束；中间两个空对象继续控制主曲线的弯垂形状。
export const CABLE_SETTINGS=Object.freeze({
  nodes:['cable_start','cable_mid_01','cable_mid_02','cable_end'],
  radiusRatio:.0015, // 半径 / 人物身高
  straightRatio:.006, // 接口外先保留一小段直线，再开始弯曲
  insertionRadii:.8, // 末端稍微插入接口表面，消除缝隙
  handleRatio:.3, // 接头过渡段的控制柄长度 / 过渡段距离
  blendFraction:.08, // 两端过渡各占主曲线的参数区间
  endpoints:[
    {mesh:'耳机',axis:[0,-1,0]},
    {mesh:'laptop',axis:[1,0,0]},
  ],
  color:0x181818,
  segments:96,
  radialSegments:8,
});

// 空对象在接口附近，但其坐标轴不一定严格垂直插孔表面。
// 只在初始化时找一次附近表面，把真实接触位置和法线保存到空对象自身坐标中。
function socketFrame(model,anchor,config,maxDistance){
  const origin=anchor.getWorldPosition(new THREE.Vector3());
  const inverse=new THREE.Matrix4().copy(anchor.matrixWorld).invert();
  const preferred=new THREE.Vector3().fromArray(config.axis).transformDirection(anchor.matrixWorld);
  const object=model.getObjectByName(config.mesh)??model.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(config.mesh));
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),closest=new THREE.Vector3();
  const triangle=new THREE.Triangle(a,b,c),surface=origin.clone(),normal=preferred.clone();
  let distance=maxDistance,matched=false;
  object?.traverse(mesh=>{
    if(!mesh.isMesh||!mesh.geometry?.getAttribute('position'))return;
    const indices=mesh.geometry.getIndex(),count=indices?.count??mesh.geometry.getAttribute('position').count;
    for(let i=0;i<count;i+=3){
      [a,b,c].forEach((point,k)=>mesh.getVertexPosition(indices?indices.getX(i+k):i+k,point).applyMatrix4(mesh.matrixWorld));
      triangle.closestPointToPoint(origin,closest);
      const candidate=closest.distanceTo(origin);
      if(candidate<distance){distance=candidate;surface.copy(closest);triangle.getNormal(normal);matched=true;}
    }
  });
  if(normal.dot(preferred)<0)normal.negate();
  return {position:surface.applyMatrix4(inverse),direction:normal.transformDirection(inverse),matched,distance:matched?distance:null};
}

export function mountCharacterCable(model,height,settings=CABLE_SETTINGS){
  const anchors=settings.nodes.map(name=>model.getObjectByName(name));
  if(anchors.some(node=>!node))return null;
  model.updateWorldMatrix(true,true);
  const socketAnchors=[anchors[0],anchors[3]],worldScale=model.getWorldScale(new THREE.Vector3()).x;
  const sockets=socketAnchors.map((anchor,i)=>socketFrame(model,anchor,settings.endpoints[i],height*worldScale*.003));
  const points=anchors.map(()=>new THREE.Vector3()),directions=[new THREE.Vector3(),new THREE.Vector3()];
  const previous=[...points,...directions].map(()=>new THREE.Vector3(Infinity,Infinity,Infinity));
  const inverse=new THREE.Matrix4(),point=new THREE.Vector3(),normal=new THREE.Vector3();
  const inside=[new THREE.Vector3(),new THREE.Vector3()],outside=[new THREE.Vector3(),new THREE.Vector3()];
  const tangents=[new THREE.Vector3(),new THREE.Vector3()];
  const startLine=new THREE.LineCurve3(inside[0],outside[0]),endLine=new THREE.LineCurve3(outside[1],inside[1]);
  const beziers=Array.from({length:3},()=>new THREE.CubicBezierCurve3());
  const guide=new THREE.CubicBezierCurve3();
  const derivative=(t,target)=>target.copy(guide.v1).sub(guide.v0).multiplyScalar(3*(1-t)**2).addScaledVector(new THREE.Vector3().subVectors(guide.v2,guide.v1),6*(1-t)*t).addScaledVector(new THREE.Vector3().subVectors(guide.v3,guide.v2),3*t*t);
  const curve=new THREE.CurvePath();[startLine,...beziers,endLine].forEach(part=>curve.add(part));
  // CurvePath.getPoint 本身已按整条路径的弧长遍历，无需再做第二次弧长映射。
  curve.getPointAt=(t,target)=>curve.getPoint(t,target);
  curve.getTangentAt=(t,target)=>curve.getTangent(t,target);
  const radius=height*settings.radiusRatio,straight=height*settings.straightRatio;
  const {segments,radialSegments}=settings;
  const geometry=new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(),new THREE.Vector3(0,1,0)),segments,radius,radialSegments,false);
  const position=geometry.getAttribute('position'),normals=geometry.getAttribute('normal');
  position.setUsage(THREE.DynamicDrawUsage);normals.setUsage(THREE.DynamicDrawUsage);
  const material=new THREE.MeshStandardMaterial({color:settings.color,roughness:.85,metalness:0});
  const mesh=new THREE.Mesh(geometry,material);mesh.name='character-headphone-cable';model.add(mesh);
  let disposed=false;

  function update(){
    if(disposed)return;
    model.updateWorldMatrix(true,true);inverse.copy(model.matrixWorld).invert();
    anchors.forEach((node,i)=>points[i].setFromMatrixPosition(node.matrixWorld).applyMatrix4(inverse));
    socketAnchors.forEach((anchor,i)=>{
      points[i?3:0].copy(sockets[i].position).applyMatrix4(anchor.matrixWorld).applyMatrix4(inverse);
      directions[i].copy(sockets[i].direction).transformDirection(anchor.matrixWorld).transformDirection(inverse);
    });
    const state=[...points,...directions];
    if(state.every((value,i)=>value.distanceToSquared(previous[i])<1e-14))return;
    state.forEach((value,i)=>previous[i].copy(value));
    for(let i=0;i<2;i++){
      const socket=points[i?3:0];
      inside[i].copy(socket).addScaledVector(directions[i],-radius*settings.insertionRadii);
      outside[i].copy(socket).addScaledVector(directions[i],straight);
    }
    // 保留上一版主曲线的中间形状，避免把中间控制柄强行当作经过点而穿入身体。
    guide.v0.copy(outside[0]);guide.v1.copy(points[1]);guide.v2.copy(points[2]);guide.v3.copy(outside[1]);
    const lo=settings.blendFraction,hi=1-lo,span=hi-lo,main=beziers[1];
    guide.getPoint(lo,main.v0);guide.getPoint(hi,main.v3);
    derivative(lo,tangents[0]);derivative(hi,tangents[1]);
    main.v1.copy(main.v0).addScaledVector(tangents[0],span/3);
    main.v2.copy(main.v3).addScaledVector(tangents[1],-span/3);
    tangents.forEach(value=>value.normalize());
    const first=beziers[0],last=beziers[2];
    const startHandle=outside[0].distanceTo(main.v0)*settings.handleRatio,endHandle=outside[1].distanceTo(main.v3)*settings.handleRatio;
    first.v0.copy(outside[0]);first.v1.copy(outside[0]).addScaledVector(directions[0],startHandle);
    first.v2.copy(main.v0).addScaledVector(tangents[0],-startHandle);first.v3.copy(main.v0);
    last.v0.copy(main.v3);last.v1.copy(main.v3).addScaledVector(tangents[1],endHandle);
    last.v2.copy(outside[1]).addScaledVector(directions[1],endHandle);last.v3.copy(outside[1]);
    beziers.forEach(part=>part.updateArcLengths());
    startLine.updateArcLengths();endLine.updateArcLengths();curve.updateArcLengths();
    const frames=curve.computeFrenetFrames(segments,false);
    for(let i=0;i<=segments;i++){
      curve.getPointAt(i/segments,point);
      for(let j=0;j<=radialSegments;j++){
        const angle=j/radialSegments*Math.PI*2,index=i*(radialSegments+1)+j;
        normal.copy(frames.normals[i]).multiplyScalar(Math.cos(angle)).addScaledVector(frames.binormals[i],Math.sin(angle));
        normals.setXYZ(index,normal.x,normal.y,normal.z);
        position.setXYZ(index,point.x+radius*normal.x,point.y+radius*normal.y,point.z+radius*normal.z);
      }
    }
    position.needsUpdate=true;normals.needsUpdate=true;geometry.computeBoundingSphere();
  }
  update();
  return {
    update,
    snapshot(){return {ready:!disposed,type:'bezier-with-socket-tangents',nodes:settings.nodes,points:points.map(value=>value.toArray()),endpoints:inside.map((value,i)=>({position:value.toArray(),outward:directions[i].toArray(),surfaceMatched:sockets[i].matched,snapDistance:sockets[i].distance})),radius,segments};},
    dispose(){if(disposed)return;disposed=true;mesh.removeFromParent();geometry.dispose();material.dispose();},
  };
}
