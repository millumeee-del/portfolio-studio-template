import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
// 从第一个模型提取完整闭合动作，三个模型的同名骨骼和初始变换一致。
export function sharedCharacterAnimation(root,source){
  const glb=readFileSync(path.join(root,'public',source.split('?')[0])),revision=createHash('sha256').update(glb).digest('hex').slice(0,16);
  const url=`/models/animation/idle-${revision}.json`,filename=path.join(root,'public',url);
  if(!existsSync(filename)){
    const jsonLength=glb.readUInt32LE(12),gltf=JSON.parse(glb.subarray(20,20+jsonLength).toString()),offset=20+jsonLength+8;
    const animation=gltf.animations?.[0];if(!animation)throw new Error('主模型缺少循环动画');
    const buffers=[],ids=new Map();let duration=0;
    function accessor(index){
      if(ids.has(index))return ids.get(index);
      const item=gltf.accessors[index],view=gltf.bufferViews[item.bufferView],size={SCALAR:1,VEC3:3,VEC4:4}[item.type];
      if(item.componentType!==5126||!size||item.sparse||view.byteStride)throw new Error('循环动画数据格式不支持');
      const start=offset+(view.byteOffset||0)+(item.byteOffset||0),id=buffers.length;
      buffers.push(glb.subarray(start,start+item.count*size*4).toString('base64'));ids.set(index,id);return id;
    }
    const tracks=animation.channels.filter(channel=>/^mixamorig[:_]?/i.test(gltf.nodes[channel.target.node]?.name||'')).map(channel=>{
      const sampler=animation.samplers[channel.sampler],times=gltf.accessors[sampler.input];duration=Math.max(duration,times.max?.[0]??0);
      return {node:gltf.nodes[channel.target.node].name.replace(/[\[\]\.:\/]/g,''),path:{translation:'position',rotation:'quaternion',scale:'scale'}[channel.target.path],times:accessor(sampler.input),values:accessor(sampler.output),interpolation:sampler.interpolation||'LINEAR'};
    });
    mkdirSync(path.dirname(filename),{recursive:true});writeFileSync(filename,JSON.stringify({name:'Shared idle 0–404',duration,frameStart:0,frameEnd:404,buffers,tracks}));
  }
  return {url,revision};
}
