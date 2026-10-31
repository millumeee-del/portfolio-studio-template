export const DEFAULT_ABOUT_PORTRAIT=Object.freeze({width:480,height:550,points:[[2,4],[100,0],[93,97],[0,100]],imageX:50,imageY:50,zoom:1,copyWidth:480,copyHeight:260,fontSize:16});
import {validateAboutTextBlocks} from './about-text.js';
export const ABOUT_CORNER_NAMES=['左上角','右上角','右下角','左下角'];
export function validateAboutContent(value){
  if(!value||typeof value!=='object'||typeof value.title!=='string'||typeof value.subtitle!=='string'||!Array.isArray(value.paragraphs)||value.paragraphs.some(p=>typeof p!=='string'))throw new Error('简介文字格式有误');
  if(value.title.length>120||value.subtitle.length>200||value.paragraphs.join('\n\n').length>4000)throw new Error('标题最多 120 字，小标题最多 200 字，简介最多 4000 字');
  return {title:value.title,subtitle:value.subtitle,paragraphs:[...value.paragraphs]};
}
export function defaultAboutPositions(){return {desktop:{referenceWidth:1120,portrait:{x:0,y:0},copy:{x:0,y:0}},mobile:{referenceWidth:480,portrait:{x:0,y:0},copy:{x:0,y:0}}};}
export function validPortraitPoints(points){
  if(!Array.isArray(points)||points.length!==4||points.some(p=>!Array.isArray(p)||p.length!==2||p.some(n=>!Number.isFinite(n)||n<0||n>100)))return false;
  let area=0;
  for(let i=0;i<4;i++){const a=points[i],b=points[(i+1)%4],c=points[(i+2)%4];if((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])<25)return false;area+=a[0]*b[1]-b[0]*a[1];}
  return area/2>=2000;
}
export function validateAboutPortrait(value){
  if(!value||typeof value!=='object')throw new Error('头像排版格式有误');
  value={...DEFAULT_ABOUT_PORTRAIT,...value};
  const limits={width:[160,760],height:[160,900],imageX:[0,100],imageY:[0,100],zoom:[1,2.5],copyWidth:[160,1000],copyHeight:[120,1200],fontSize:[10,72]};
  for(const [key,[min,max]] of Object.entries(limits))if(!Number.isFinite(value[key])||value[key]<min||value[key]>max)throw new Error('头像参数超出范围：'+key);
  if(!validPortraitPoints(value.points))throw new Error('头像四角不能交叉，且需要保留足够的画面');
  const next=Object.fromEntries(Object.keys(limits).map(key=>[key,Math.round(value[key]*100)/100]));
  next.points=value.points.map(p=>p.map(n=>Math.round(n*100)/100));
  if(value.imageSrc!==undefined){
    if(typeof value.imageSrc!=='string'||!/^\/(?:contacts|works\/uploads)\/[^?#\\]+\.(?:png|jpe?g|webp|gif|avif)$/i.test(value.imageSrc)||value.imageSrc.split('/').includes('..'))throw new Error('头像请选择本地图片');
    next.imageSrc=value.imageSrc;
  }
  if(value.content!==undefined)next.content=validateAboutContent(value.content);
  if(value.textBlocks!==undefined)next.textBlocks=validateAboutTextBlocks(value.textBlocks);
  const positions=value.positions??defaultAboutPositions();next.positions={};
  for(const profile of ['desktop','mobile']){const p=positions[profile];if(!p||!Number.isFinite(p.referenceWidth)||p.referenceWidth<160||p.referenceWidth>3000)throw new Error('About 排版参考宽度有误');next.positions[profile]={referenceWidth:p.referenceWidth};for(const key of ['portrait','copy']){if(!p[key]||['x','y'].some(axis=>!Number.isFinite(p[key][axis])||Math.abs(p[key][axis])>3000))throw new Error('About 框的位置超出范围');next.positions[profile][key]={x:Math.round(p[key].x*100)/100,y:Math.round(p[key].y*100)/100};}}
  return next;
}
export function aboutPortraitStyle(value){
  value={...DEFAULT_ABOUT_PORTRAIT,...value};
  const style=[
    `--about-portrait-width:${value.width}px`,
    `--about-portrait-column:${value.width/1120*100}%`,
    `--about-portrait-fit-width:${value.width/1120*100}cqw`,
    `--about-portrait-aspect:${value.width} / ${value.height}`,
    `--about-portrait-points:${value.points.map(p=>p.map(n=>n+'%').join(' ')).join(',')}`,
    `--about-image-x:${value.imageX}%`,`--about-image-y:${value.imageY}%`,`--about-image-zoom:${value.zoom}`,
    `--about-copy-width:${value.copyWidth}px`,`--about-copy-fit-width:${value.copyWidth/1120*100}cqw`,
    `--about-copy-height:${value.copyHeight}px`,`--about-copy-fit-height:${value.copyHeight/1120*100}cqw`,
    `--about-bio-font-size:${value.fontSize}px`
  ];
  const positions=value.positions??defaultAboutPositions();
  for(const profile of ['desktop','mobile'])for(const key of ['portrait','copy'])for(const axis of ['x','y'])style.push(`--about-${profile}-${key}-${axis}:${positions[profile][key][axis]/positions[profile].referenceWidth*100}cqw`);
  return style.join(';')+';';
}
