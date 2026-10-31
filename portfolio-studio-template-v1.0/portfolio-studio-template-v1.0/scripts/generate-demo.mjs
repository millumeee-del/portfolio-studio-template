import {mkdir,writeFile,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import sharp from 'sharp';
import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const save=async(name,content)=>{const p=path.join(root,'public',name);await mkdir(path.dirname(p),{recursive:true});await writeFile(p,content);};
const png=async(name,svg)=>save(name,await sharp(Buffer.from(svg)).png().toBuffer());
const colors=['#f1b746','#8872c4','#4e9c94','#e47564','#8ca6cf'];
for(let i=0;i<5;i++){
 await png(`demo/project-${i+1}.png`,`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="750"><rect width="1000" height="750" fill="${colors[i]}"/><circle cx="500" cy="355" r="230" fill="#f9f5e8"/><rect x="350" y="200" width="300" height="300" rx="36" transform="rotate(${15+i*12} 500 350)" fill="#242421"/><circle cx="500" cy="355" r="75" fill="${colors[(i+1)%5]}"/><text x="60" y="680" font-family="sans-serif" font-size="50" fill="#242421">STUDY 0${i+1}</text></svg>`);
}
await png('contacts/avatar.png','<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><rect width="800" height="1000" fill="#d8ddcf"/><circle cx="400" cy="360" r="165" fill="#f4bc58"/><rect x="150" y="570" width="500" height="500" rx="200" fill="#2c504e"/><circle cx="350" cy="350" r="12"/><circle cx="450" cy="350" r="12"/><path d="M350 420 Q400 460 450 420" fill="none" stroke="#242421" stroke-width="10"/></svg>');
for(const [name,shape] of Object.entries({mail:'<rect x="7" y="12" width="34" height="24" rx="3"/><path d="m8 14 16 12 16-12"/>',link:'<path d="m19 29 10-10M19 16l4-4a9 9 0 0 1 13 13l-4 4M29 32l-4 4a9 9 0 0 1-13-13l4-4"/>',code:'<path d="m17 14-10 10 10 10m14-20 10 10-10 10m-4-24-6 28"/>',chat:'<path d="M8 9h32v25H23L12 41v-7H8Z"/>',star:'<path d="m24 5 6 13 14 2-10 10 2 14-12-7-12 7 2-14L4 20l14-2Z"/>'}))await save(`icons/${name}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#242421" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${shape}</svg>`);
await save('favicon.svg','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="8" fill="#efb84a"/><circle cx="20" cy="20" r="10" fill="#242421"/></svg>');
globalThis.FileReader=class {readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}};
for(let i=0;i<3;i++){
 const scene=new THREE.Scene(),object=new THREE.Group();object.name='DemoRoot';scene.add(object);
 const material=new THREE.MeshStandardMaterial({color:colors[i],roughness:.65});
 for(const [geometry,x,y,z] of [[new THREE.BoxGeometry(.9,1.1,.55),0,1.4,0],[new THREE.SphereGeometry(.43,16,12),0,2.4,0],[new THREE.BoxGeometry(.3,.8,.35),-.27,.45,0],[new THREE.BoxGeometry(.3,.8,.35),.27,.45,0],[new THREE.SphereGeometry(.2,12,8),-.72,1.35,0],[new THREE.SphereGeometry(.2,12,8),.72,1.35,0]]){const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);object.add(mesh);}
 for(const x of [-.16,.16]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.05,8,6),new THREE.MeshStandardMaterial({color:'#242421'}));eye.position.set(x,2.43,.4);object.add(eye);}
 const duration=404/30,clip=new THREE.AnimationClip('Idle',duration,[new THREE.VectorKeyframeTrack('DemoRoot.position',[0,duration/4,duration/2,duration*3/4,duration],[0,0,0,0,.09,0,0,0,0,0,.09,0,0,0,0])]);
 const glb=await new GLTFExporter().parseAsync(scene,{binary:true,animations:[clip]});await save(`models/demo-${i}.glb`,new Uint8Array(glb));
}
const ffmpeg=process.env.FFMPEG_PATH||'ffmpeg';
for(const [index,year] of ['all','2026','2024','2022'].entries()){
 const out=path.join(root,'public/showreel',year+'.mp4');await mkdir(path.dirname(out),{recursive:true});
 const run=spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-y','-f','lavfi','-i',`testsrc2=size=640x360:rate=24:duration=4`,'-vf',`hue=h=${index*65}`,'-an','-c:v','libx264','-pix_fmt','yuv420p','-crf','28','-movflags','+faststart',out],{windowsHide:true});if(run.error||run.status)throw new Error('Set FFMPEG_PATH to an FFmpeg executable to regenerate demo videos.');
 await sharp(path.join(root,'public/demo/project-'+(index+1)+'.png')).resize(640,360).webp().toFile(path.join(root,'public/showreel',year+'-poster.webp'));
}
console.log('Generated original geometric demo assets; no personal source media used.');
