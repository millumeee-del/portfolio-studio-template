// 同一行的增长只计算一次；保留下一行原有的留白。
export function translatedCanvasGrowth(items){
  const bands=[];
  for(const item of items.filter(item=>item.extra>0).sort((a,b)=>a.y-b.y)){
    const end=item.y+item.height+(item.captionHeight||0),required=end+item.extra,previous=bands.at(-1);
    if(previous&&item.y<previous.end-1){previous.end=Math.max(previous.end,end);previous.required=Math.max(previous.required,required);}
    else bands.push({start:item.y,end,required});
  }
  for(const band of bands)band.extra=Math.max(0,band.required-band.end);
  return {extra:bands.reduce((sum,band)=>sum+band.extra,0),shifts:items.map(item=>bands.reduce((sum,band)=>sum+(band.end<=item.y+1?band.extra:0),0))};
}
