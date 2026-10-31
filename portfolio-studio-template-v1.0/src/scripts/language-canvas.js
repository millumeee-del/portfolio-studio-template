import {translatedCanvasGrowth} from '../lib/language-canvas-layout.js';
let dispose;
// 测量最后一个有内容的行框；末尾回车不应把下方图片额外往下推。
// Range 只读取实际排版，不改写正文，也保留正文中间主动输入的空行。
function textContentHeight(block){
  const top=block.getBoundingClientRect().top;
  let bottom=top;
  for(const element of block.querySelectorAll(':scope > h2,:scope > p')){
    const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);
    let node,last,end;
    while(node=walker.nextNode()){
      const length=node.nodeValue.trimEnd().length;
      if(length){last=node;end=length;}
    }
    if(!last)continue;
    const range=document.createRange();range.selectNodeContents(element);range.setEnd(last,end);
    const rect=[...range.getClientRects()].filter(rect=>rect.width>0&&rect.height>0).at(-1);
    if(!rect)continue;
    const lineHeight=parseFloat(getComputedStyle(element).lineHeight);
    bottom=Math.max(bottom,rect.bottom+Math.max(0,(lineHeight-rect.height)/2));
  }
  return Math.ceil(bottom-top);
}
export function mountLanguageCanvas(){
  dispose?.();const canvas=document.querySelector('.work-canvas:not(.editor-artboard)');if(!canvas)return;
  const frames=[...canvas.querySelectorAll(':scope > .canvas-frame')],original=frames.map(node=>({top:node.style.top,height:node.style.height})),originalHeight=canvas.style.height;
  let queued,lastWidth=0;
  const reset=()=>{frames.forEach((node,i)=>{node.style.top=original[i].top;node.style.height=original[i].height;node.querySelector('.block-text')?.style.removeProperty('overflow');});canvas.style.height=originalHeight;};
  function refresh(){
    cancelAnimationFrame(queued);queued=requestAnimationFrame(()=>{
      reset();if(document.documentElement.lang!=='en'||matchMedia('(max-width:700px)').matches)return;
      const base=canvas.getBoundingClientRect(),scale=canvas.clientWidth/Number(getComputedStyle(canvas).getPropertyValue('--canvas-width'));
      const items=frames.map(node=>{const rect=node.getBoundingClientRect(),text=node.querySelector(':scope > .block-text'),caption=node.querySelector('figcaption'),reserved=Number(node.dataset.captionHeight||0)*scale;
        return {y:rect.top-base.top,height:rect.height,captionHeight:reserved,extra:text?Math.max(0,textContentHeight(text)-rect.height):caption?Math.max(0,caption.getBoundingClientRect().height+parseFloat(getComputedStyle(caption).marginTop)-reserved):0,text};});
      const growth=translatedCanvasGrowth(items);
      frames.forEach((node,i)=>{node.style.top=(items[i].y+growth.shifts[i])+'px';if(items[i].text){node.style.height=(items[i].height+items[i].extra)+'px';items[i].text.style.overflow='visible';}});
      canvas.style.height=(base.height+growth.extra)+'px';
    });
  }
  const observer=new MutationObserver(refresh);observer.observe(canvas,{childList:true,subtree:true,characterData:true});
  const resize=new ResizeObserver(()=>{if(lastWidth!==canvas.clientWidth){lastWidth=canvas.clientWidth;refresh();}});resize.observe(canvas);
  document.addEventListener('site:language-change',refresh);window.addEventListener('resize',refresh);document.fonts?.ready.then(refresh);refresh();
  dispose=()=>{cancelAnimationFrame(queued);observer.disconnect();resize.disconnect();document.removeEventListener('site:language-change',refresh);window.removeEventListener('resize',refresh);reset();};
}
