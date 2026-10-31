import * as THREE from 'three';
const clips=new Map();
export async function loadSharedCharacterAnimation(url){
  if(!url)return null;
  if(!clips.has(url))clips.set(url,(async()=>{
    const response=await fetch(url);if(!response.ok)throw new Error('完整人物动作加载失败');
    const source=await response.json(),buffers=source.buffers.map(base64=>{const raw=atob(base64),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return new Float32Array(bytes.buffer);});
    const tracks=source.tracks.map(track=>new (track.path==='quaternion'?THREE.QuaternionKeyframeTrack:THREE.VectorKeyframeTrack)(track.node+'.'+track.path,buffers[track.times],buffers[track.values],track.interpolation==='STEP'?THREE.InterpolateDiscrete:THREE.InterpolateLinear));
    return new THREE.AnimationClip(source.name,source.duration,tracks);
  })().catch(error=>{clips.delete(url);throw error;}));
  return clips.get(url);
}
