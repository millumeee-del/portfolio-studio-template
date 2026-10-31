// 画布尺寸与顺序共用逻辑；坐标以设计画布的 px 为单位保存。
export const CANVAS_DEFAULTS=Object.freeze({width:600,grid:8,captionReserve:32});
export const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export function readingOrder(blocks){return [...blocks].sort((a,b)=>(a.layout?.y??0)-(b.layout?.y??0)||(a.layout?.x??0)-(b.layout?.x??0));}
export function captionExtent(block){
  if(!['image','video'].includes(block.type)||!block.caption)return 0;
  if(Number.isFinite(block.captionHeight))return block.captionHeight;
  // 尚未在编辑器测量的旧数据，按换行与框宽预留说明空间。
  const perLine=Math.max(1,Math.floor((block.layout?.width||600)/12));
  return block.caption.split('\n').reduce((lines,text)=>lines+Math.max(1,Math.ceil(text.length/perLine)),0)*CANVAS_DEFAULTS.captionReserve;
}
export function canvasHeight(blocks){return Math.ceil(Math.max(80,...blocks.map(b=>(b.layout?.y??0)+(b.layout?.height??0)+captionExtent(b)))+24);}
export function frameStyle(block,width){const r=block.layout;return `left:${r.x/width*100}%;top:calc(${r.y/width} * 100cqw);width:${r.width/width*100}%;height:calc(${r.height/width} * 100cqw);--frame-fit:${block.fit||'cover'};--canvas-text-size:${block.fontSize||16};--mobile-spacer-height:${Math.min(200,r.height)}px;`;}
export function resizeCanvas(draft,width){const old=draft.canvasWidth||width,ratio=width/old;for(const b of draft.blocks){if(b.layout)for(const key of ['x','y','width','height'])b.layout[key]=Math.round(b.layout[key]*ratio*10)/10;if(Number.isFinite(b.captionHeight))b.captionHeight=Math.round(b.captionHeight*ratio*100)/100;}draft.canvasWidth=width;}
export function snapRect(rect,others,width,{resize=false,grid=true}={}){
  const next={...rect},guides=[],threshold=6;
  if(grid){const step=CANVAS_DEFAULTS.grid;next.x=Math.round(next.x/step)*step;next.y=Math.round(next.y/step)*step;if(resize){next.width=Math.max(24,Math.round(next.width/step)*step);next.height=Math.max(24,Math.round(next.height/step)*step);}}
  const vertical=[0,width/2,width],horizontal=[0];
  for(const r of others){vertical.push(r.x,r.x+r.width/2,r.x+r.width);horizontal.push(r.y,r.y+r.height/2,r.y+r.height);}
  function align(points,targets,axis){let nearest=null;for(const point of points)for(const target of targets){const delta=target-point;if(Math.abs(delta)<=threshold&&(!nearest||Math.abs(delta)<Math.abs(nearest.delta)))nearest={delta,target};}if(nearest){next[axis]+=nearest.delta;guides.push({axis:axis==='x'?'vertical':'horizontal',value:nearest.target});}}
  if(grid&&!resize){align([next.x,next.x+next.width/2,next.x+next.width],vertical,'x');align([next.y,next.y+next.height/2,next.y+next.height],horizontal,'y');}
  next.width=clamp(next.width,24,width);next.x=clamp(next.x,0,width-next.width);next.y=clamp(next.y,0,20000-next.height);next.height=clamp(next.height,24,6000);
  return {rect:next,guides};
}
