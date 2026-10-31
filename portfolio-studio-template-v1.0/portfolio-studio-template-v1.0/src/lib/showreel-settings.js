export function validateShowreelSettings(value){
  const text=(v,max)=>{if(typeof v!=='string'||v.length>max)throw new Error('文字过长或格式不正确');return v;};
  if(!value||!Array.isArray(value.cards)||value.cards.length!==3)throw new Error('请保留三个年份');
  return {title:text(value.title,80),titleEn:text(value.titleEn,80),hint:text(value.hint,160),hintEn:text(value.hintEn,160),...(value.watchLayouts?{watchLayouts:validateShowreelWatchLayouts(value.watchLayouts)}:{}),cards:[2026,2024,2022].map(year=>{
    const card=value.cards.find(card=>card?.year===year);if(!card)throw new Error('年份与视频不匹配');
    const thumbnail=text(card.thumbnail??'',2048);
    if(thumbnail&&!/^\/(?:works\/uploads|showreel)\/[a-zA-Z0-9_./%-]+\.(?:png|jpe?g|webp|gif|avif)$/i.test(thumbnail))throw new Error('缩略图请选择本地图片文件');
    if(thumbnail.split('/').includes('..'))throw new Error('缩略图地址不正确');
    return {year,label:text(card.label,40),description:text(card.description,120),descriptionEn:text(card.descriptionEn,120),...(thumbnail?{thumbnail}:{})};
  })};
}

export function validateShowreelWatchLayouts(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('播放器排版格式不正确');
  const layouts={};
  for(const profile of ['desktop','mobile']){
    const item=value[profile];if(item==null)continue;
    if(!Number.isFinite(item.x)||Math.abs(item.x)>200||!Number.isFinite(item.y)||Math.abs(item.y)>4000)throw new Error('年份位置超出范围');
    layouts[profile]={x:Math.round(item.x*10000)/10000,y:Math.round(item.y*100)/100};
  }
  return layouts;
}

export function showreelWatchLayoutCSS(layouts={}){
  return Object.entries(validateShowreelWatchLayouts(layouts)).map(([profile,item])=>`@media(${profile==='mobile'?'max-width:700px':'min-width:701px'}){.showreel-watch-toolbar{transform:translateY(${item.y}px)}.showreel-watch-toolbar nav{transform:translateX(${item.x}vw)}}`).join('\n');
}
