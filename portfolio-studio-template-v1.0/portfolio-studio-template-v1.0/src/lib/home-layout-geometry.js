const edges=(box,axis)=>axis==='x'?[box.x,box.x+box.width/2,box.x+box.width]:[box.y,box.y+box.height/2,box.y+box.height];
export function homeSnapTargets(other,width,height){
  const boxes=Array.isArray(other)?other:[other];
  const targets=(axis,labels)=>boxes.flatMap(box=>edges(box,axis).map((value,index)=>({value,label:(box.label||'另一框')+labels[index]})));
  return {
    x:[{value:0,label:'画布左边'},{value:width/2,label:'画布水平居中'},{value:width,label:'画布右边'},...targets('x',['左边','中线','右边'])],
    y:[{value:0,label:'画布顶部'},{value:height/2,label:'画布垂直居中'},{value:height,label:'画布底部'},...targets('y',['顶部','中线','底部'])]
  };
}
function nearest(values,targets,threshold){
  let best=null;
  for(const value of values)for(const target of targets){
    const delta=target.value-value;
    if(Math.abs(delta)<=threshold&&(!best||Math.abs(delta)<Math.abs(best.delta)))best={...target,delta};
  }
  return best;
}
export function moveHomeBox(box,dx,dy,targets,threshold=7){
  const next={...box,x:box.x+dx,y:box.y+dy},guides={};
  for(const axis of ['x','y']){
    const match=nearest(edges(next,axis),targets[axis],threshold);
    if(match){next[axis]+=match.delta;guides[axis]=match;}
  }
  return {box:next,guides};
}
export function resizeHomeBox(box,handle,dx,dy,targets,threshold=7,uniform=false,minHeight=48,minWidth=48){
  const west=handle.includes('w'),east=handle.includes('e'),north=handle.includes('n'),south=handle.includes('s');
  const horizontal=west||east,vertical=north||south;
  let width=Math.max(minWidth,box.width+(west?-dx:east?dx:0)),height=Math.max(minHeight,box.height+(north?-dy:south?dy:0));
  if(uniform){
    const factor=horizontal&&vertical?(Math.abs(width/box.width-1)>=Math.abs(height/box.height-1)?width/box.width:height/box.height):horizontal?width/box.width:height/box.height;
    const safe=Math.max(factor,minWidth/box.width,minHeight/box.height);width=box.width*safe;height=box.height*safe;
  }
  const place=()=>({...box,width,height,x:west?box.x+box.width-width:!horizontal&&uniform?box.x+(box.width-width)/2:box.x,y:north?box.y+box.height-height:!vertical&&uniform?box.y+(box.height-height)/2:box.y});
  let next=place();const guides={};
  const sx=horizontal?nearest([west?next.x:next.x+width],targets.x,threshold):null;
  const sy=vertical?nearest([north?next.y:next.y+height],targets.y,threshold):null;
  if(uniform){
    const axis=sx&&(!sy||Math.abs(sx.delta)<=Math.abs(sy.delta))?'x':sy?'y':null;
    if(axis){
      const match=axis==='x'?sx:sy;
      const newWidth=axis==='x'?width+(west?-match.delta:match.delta):(height+(north?-match.delta:match.delta))*box.width/box.height;
      if(newWidth>=minWidth&&newWidth*box.height/box.width>=minHeight){width=newWidth;height=width*box.height/box.width;guides[axis]=match;next=place();}
    }
  }else{
    if(sx&&width+(west?-sx.delta:sx.delta)>=minWidth){width+=west?-sx.delta:sx.delta;guides.x=sx;}
    if(sy&&height+(north?-sy.delta:sy.delta)>=minHeight){height+=north?-sy.delta:sy.delta;guides.y=sy;}
    next=place();
  }
  return {box:next,guides};
}
