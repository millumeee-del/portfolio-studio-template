import {captionExtent,clamp} from './work-canvas.js';

// 距离按可见内容边缘计算，图片 / 视频下方的说明也占用空间。
export function contentBounds(block){return {...block.layout,height:block.layout.height+captionExtent(block)};}
const bottom=r=>r.y+r.height;
const overlaps=(a,b)=>Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>Math.min(a.width,b.width)*.1;
function dimension(a,b,kind='measure'){
  return {x:Math.min(a.x+a.width,b.x+b.width)-12,from:bottom(a),to:b.y,gap:b.y-bottom(a),kind};
}
function neighbours(rect,others){
  const column=others.filter(other=>overlaps(rect,other));
  const above=column.filter(other=>bottom(other)<=rect.y+.01).sort((a,b)=>bottom(b)-bottom(a))[0];
  const below=column.filter(other=>other.y>=bottom(rect)-.01).sort((a,b)=>a.y-b.y)[0];
  return {above,below};
}
export function measureContentSpacing(block,others){
  const rect=contentBounds(block),bounds=others.filter(item=>item.layout).map(contentBounds),{above,below}=neighbours(rect,bounds),guides=[];
  if(above)guides.push(dimension(above,rect));
  else if(!bounds.some(other=>overlaps(other,rect)&&other.y<rect.y)&&rect.y>.5)guides.push({x:rect.x+rect.width-12,from:0,to:rect.y,gap:rect.y,kind:'start'});
  if(below)guides.push(dimension(rect,below));
  return guides;
}

// 在最近上下邻居旁，寻找与已有内容间距相同的位置；网格取整不吞掉等距目标。
export function snapContentSpacing(block,others,{enabled=true,threshold=6}={}){
  const rect=contentBounds(block),bounds=others.filter(item=>item.layout).map(contentBounds),{above,below}=neighbours(rect,bounds),references=[];
  for(const a of bounds){const b=neighbours(a,bounds.filter(other=>other!==a)).below;if(b&&b.y-bottom(a)>=8)references.push(dimension(a,b,'reference'));}
  const candidates=[];
  for(const reference of references){
    if(above)candidates.push({y:bottom(above)+reference.gap,references:[reference]});
    if(below)candidates.push({y:below.y-rect.height-reference.gap,references:[reference]});
  }
  if(above&&below)candidates.push({y:(bottom(above)+below.y-rect.height)/2,references:[]});
  const best=enabled?candidates.filter(candidate=>candidate.y>=0&&candidate.y<=20000-block.layout.height&&Math.abs(candidate.y-rect.y)<=threshold).sort((a,b)=>Math.abs(a.y-rect.y)-Math.abs(b.y-rect.y))[0]:null;
  const layout={...block.layout};if(best)layout.y=clamp(best.y,0,20000-layout.height);
  const guides=measureContentSpacing({...block,layout},others);
  if(best){
    for(const guide of guides)if(guide.kind!=='start'&&(best.references.length?best.references.some(ref=>Math.abs(ref.gap-guide.gap)<.1):true))guide.kind='equal';
    guides.push(...best.references);
  }
  return {layout,guides,snapped:!!best};
}
