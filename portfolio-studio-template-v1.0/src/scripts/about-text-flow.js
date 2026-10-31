import {flowAboutText} from '../lib/about-text.js';
let cleanup;
export function disposeAboutTextFlow(){cleanup?.();cleanup=undefined;}
export function mountAboutTextFlow(){
  disposeAboutTextFlow();
  const page=document.querySelector('[data-about-page]');if(!page)return;
  page.__aboutFlow?.();
  let queued;
  function refresh(){
    cancelAnimationFrame(queued);queued=requestAnimationFrame(()=>{
      const nodes=[...page.querySelectorAll('[data-about-block]')];
      nodes.forEach(node=>node.style.removeProperty('--about-flow-y'));
      const top=page.getBoundingClientRect().top;
      if(matchMedia('(max-width:700px)').matches&&!document.body.classList.contains('is-about-shape-editing')){
        const portraitBottom=page.querySelector('[data-about-portrait]').getBoundingClientRect().bottom-top;
        const boxes=nodes.map((node,index)=>{const rect=node.getBoundingClientRect();return {index,y:rect.top-top,height:rect.height};});
        for(const box of flowAboutText(boxes,portraitBottom))nodes[box.index].style.setProperty('--about-flow-y',box.y+'px');
      }
      const bottom=Math.ceil(Math.max(0,...nodes.map(node=>node.getBoundingClientRect().bottom-top)));
      const value=bottom+'px';if(page.style.getPropertyValue('--about-measured-text-bottom')!==value)page.style.setProperty('--about-measured-text-bottom',value);
    });
  }
  const resize=new ResizeObserver(refresh),observe=()=>{resize.disconnect();resize.observe(page);for(const node of page.querySelectorAll('[data-about-block],[data-about-portrait]'))resize.observe(node);refresh();};
  const mutation=new MutationObserver(observe);mutation.observe(page,{childList:true,subtree:true,characterData:true});
  const editing=new MutationObserver(refresh);editing.observe(document.body,{attributes:true,attributeFilter:['class']});
  observe();window.addEventListener('resize',refresh);document.addEventListener('site:language-change',refresh);document.fonts?.ready.then(refresh);
  cleanup=page.__aboutFlow=()=>{cancelAnimationFrame(queued);resize.disconnect();mutation.disconnect();editing.disconnect();window.removeEventListener('resize',refresh);document.removeEventListener('site:language-change',refresh);};
}
