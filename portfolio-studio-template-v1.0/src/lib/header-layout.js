export const HEADER_ITEMS={nav:'顶部导航',moods:'心情按钮组',language:'语言按钮',translation:'译文微调'};
export const headerSelector=key=>'[data-header-item="'+key+'"]';

export function validateHeaderLayout(value){
  if(!value||typeof value!=='object')throw new Error('顶部排版格式不正确');
  const num=(v,min,max)=>{if(!Number.isFinite(v)||v<min||v>max)throw new Error('顶部排版数值超出范围');return Math.round(v*1000)/1000;};
  const referenceWidth=num(value.referenceWidth,160,6000),items={};
  // An older running local server could strip newly added anchor fields on save.
  const anchorFieldsStripped=!value.items?.nav?.anchor&&Math.abs(value.items?.nav?.x??referenceWidth)<referenceWidth/4;
  for(const key of Object.keys(HEADER_ITEMS)){
    const item=value.items?.[key];if(!item)continue;
    const next={x:num(item.x,-referenceWidth,referenceWidth*2),y:num(item.y,-100,4000),scale:num(item.scale,.25,4),fontSize:num(item.fontSize,6,100),gap:num(item.gap,0,200)};
    next.anchor=['left','center','right'].includes(item.anchor)?item.anchor:key==='nav'?'center':'right';
    // Upgrade the initial viewport-coordinate format without rewriting user data.
    if(!item.anchor&&!anchorFieldsStripped){
      const width=key==='nav'?next.fontSize*9.61328125+next.gap*2:key==='language'?(referenceWidth<=600?40:78):key==='translation'?next.fontSize*4+26:referenceWidth<=600?64+next.gap:referenceWidth<=900?76+next.gap:216.5625*next.fontSize/13;
      next.x=next.anchor==='center'?next.x+width*next.scale/2-referenceWidth/2:referenceWidth-next.x-width*next.scale;
    }
    if(!item.anchor&&key==='translation'&&next.x>referenceWidth*2/3){next.x=referenceWidth-next.x-(next.fontSize*4+26)*next.scale;next.anchor='left';}
    next.x=Math.round(next.x*1000)/1000;items[key]=next;
  }
  return {referenceWidth,items};
}

// The same CSS is emitted in the document head and during local preview.
// Keep the navigation centered and action buttons anchored to the right edge.
export function headerLayoutCSS(store){
  return ['desktop','mobile'].map(profile=>{
    const value=store?.[profile]?.header;if(!value)return '';
    const header=validateHeaderLayout(value);
    const rules=Object.entries(header.items).map(([key,item])=>{
      const width=key==='language'?(profile==='mobile'?40:78):key==='translation'?item.fontSize*4+26:profile==='mobile'?64+item.gap:216.5625*item.fontSize/13;
      const selector=headerSelector(key),position=item.anchor==='center'?`left:calc(50vw + ${item.x}px)!important;right:auto!important;translate:-50% 0!important;transform-origin:top center!important;`:item.anchor==='left'?`left:${item.x/header.referenceWidth*100}vw!important;right:auto!important;translate:none!important;transform-origin:top left!important;`:`left:auto!important;right:clamp(0px,${item.x}px,calc(100vw - ${width*item.scale}px))!important;translate:none!important;transform-origin:top right!important;`;
      const font=profile==='mobile'&&key==='nav'?`min(${item.fontSize}px,${item.fontSize/header.referenceWidth*100}vw)`:`${item.fontSize}px`;
      const gap=profile==='mobile'&&key==='nav'?`min(${item.gap}px,${item.gap/header.referenceWidth*100}vw)`:`${item.gap}px`;
      return `${selector}{position:fixed!important;${position}top:${item.y}px!important;bottom:auto!important;margin:0!important;transform:scale(${item.scale})!important;font-size:${font}!important;gap:${gap}!important;z-index:27;}`;
    }).join('');
    return `@media(${profile==='mobile'?'max-width:700px':'min-width:701px'}){${rules}}`;
  }).join('');
}
