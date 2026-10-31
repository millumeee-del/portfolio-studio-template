export function initialShowreelIndex(years,search){
  const year=new URLSearchParams(search).get('year');
  const index=years.findIndex(value=>String(value)===year);
  return index<0?0:index;
}

// 首尾衔接时临时循环排列原面板，只滑一屏，结束后恢复顺序。
export function showreelWatchTransition(current,next,count){
  const index=((next%count)+count)%count,start=next<0?count-1:next>=count?1:0;
  const order=Array.from({length:count},(_,i)=>(i+start)%count);
  return {index,order,from:order.indexOf(current),to:order.indexOf(index)};
}

export function reelOffset(index,position,count){
  return ((index-position+count/2)%count+count)%count-count/2;
}

export function showreelArcLayout(count,position,width,height,cardHeight,gap=width<=600?20:28,spacingScale=1,{cardWidth=width*.7,cardScale=1,ringHeight=height*3.2,centerY=height/2,anchorX=width/2}={}){
  cardHeight*=cardScale;
  const originalStep=Math.max(cardHeight+12,Math.min(210,(height-cardHeight-60)/2));
  // 放大的是卡片之间的留白，不是卡片本身。
  const step=originalStep+Math.max(12,originalStep-cardHeight)*(Math.max(1,spacingScale)-1);
  const radius=Math.max(1,ringHeight/2,step/.8),crest=anchorX-cardWidth*cardScale/2-gap,centerX=crest-radius;
  const angle=Math.asin(step/(radius+gap+cardWidth*cardScale/2));
  return {radius,crest,step,centerY,cards:Array.from({length:count},(_,index)=>{
    const offset=reelOffset(index,position,count),theta=offset*angle,distance=Math.abs(offset),scale=cardScale*(1-.05*distance);
    const dotX=centerX+radius*Math.cos(theta),dotY=centerY+radius*Math.sin(theta),normalOffset=gap+cardWidth*scale/2;
    // 卡片横轴与标记点处的外法线重合，位置和角度使用同一个圆心计算。
    return {x:dotX+normalOffset*Math.cos(theta)-cardWidth/2,y:dotY+normalOffset*Math.sin(theta),dotX,dotY,scale,rotation:offset===0?0:theta*180/Math.PI,opacity:(1-.22*distance)*Math.min(1,Math.max(0,(count/2-distance)/.22))};
  })};
}
