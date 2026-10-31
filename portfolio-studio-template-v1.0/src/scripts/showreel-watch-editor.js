import {showreelWatchLayoutCSS} from '../lib/showreel-settings.js';
export function mountShowreelWatchEditor(){
  const root=document.querySelector('[data-showreel-layout-editor]'),nav=document.querySelector('.showreel-watch-toolbar nav');
  if(!root||!nav)return ()=>{};
  const abort=new AbortController(),{signal}=abort,on=(node,type,fn)=>node.addEventListener(type,fn,{signal});
  const toolbar=root.querySelector('[data-reel-layout-toolbar]'),entry=root.querySelector('[data-reel-layout-open]'),box=root.querySelector('[data-reel-layout-box]'),status=root.querySelector('[data-reel-layout-status]'),guide=root.querySelector('[data-reel-layout-guide]');
  const saved=document.querySelector('[data-watch-layout-saved]'),preview=document.createElement('style');
  // Keep live positions after the saved rules so an existing layout cannot override dragging.
  if(saved)saved.after(preview);else document.body.append(preview);
  let settings,version,profile,draft,active=false,busy=false,drag;
  const mode=()=>matchMedia('(max-width:700px)').matches?'mobile':'desktop';
  const cssViewportWidth=()=>parseFloat(getComputedStyle(document.documentElement).width)||innerWidth;
  function setBusy(value){busy=value;root.querySelectorAll('button').forEach(button=>button.disabled=value);}
  function render(){
    if(!active)return;preview.textContent=showreelWatchLayoutCSS({[profile]:draft});
    const rect=nav.getBoundingClientRect();Object.assign(box.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});
  }
  function close(){active=false;drag=undefined;box.classList.remove('is-dragging');toolbar.hidden=box.hidden=guide.hidden=true;entry.hidden=false;preview.textContent='';}
  async function request(options){const response=await fetch('/__portfolio-editor/showreels',{...options,signal}),data=await response.json();if(!response.ok)throw new Error(data.error||'排版操作失败');return data;}
  on(entry,'click',async()=>{
    setBusy(true);
    try{const data=await request();settings=data.settings;version=data.version;profile=mode();draft=structuredClone(settings.watchLayouts?.[profile]||{x:0,y:0});active=true;entry.hidden=true;toolbar.hidden=box.hidden=false;root.querySelector('[data-reel-layout-device]').textContent=(profile==='mobile'?'手机':'电脑')+' · 拖动年份框';status.textContent='上下拖动会带着整行一起移动，保持水平对齐。方向键微调；Alt 暂停吸附。';render();}
    catch(error){entry.textContent=error.message;}finally{setBusy(false);}
  });
  on(root.querySelector('[data-reel-layout-cancel]'),'click',close);
  on(root.querySelector('[data-reel-layout-reset]'),'click',()=>{draft={x:0,y:0};render();status.textContent='已恢复默认位置，保存后生效。';});
  on(box,'pointerdown',event=>{
    if(!active||busy||event.button!==0)return;event.preventDefault();box.focus({preventScroll:true});
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,item:{...draft},rect:nav.getBoundingClientRect()};box.classList.add('is-dragging');box.setPointerCapture(event.pointerId);
  });
  on(window,'pointermove',event=>{
    if(!drag||busy||event.pointerId!==drag.id)return;event.preventDefault();
    const main=document.querySelector('.portfolio-main').getBoundingClientRect(),width=drag.rect.width,viewportWidth=cssViewportWidth();
    let left=Math.max(main.left,Math.min(viewportWidth-width,drag.rect.left+event.clientX-drag.x)),top=Math.max(0,Math.min(innerHeight-drag.rect.height,drag.rect.top+event.clientY-drag.y));
    guide.hidden=true;
    if(!event.altKey){
      const candidates=[main.left,(main.left+viewportWidth-width)/2,viewportWidth-width-16];
      const snap=candidates.find(value=>Math.abs(left-value)<7);
      if(snap!==undefined){left=snap;guide.style.left=(snap===candidates[1]?snap+width/2:snap)+'px';guide.hidden=false;}
    }
    draft={x:drag.item.x+(left-drag.rect.left)/viewportWidth*100,y:drag.item.y+top-drag.rect.top};render();
  });
  const up=event=>{if(drag?.id===event.pointerId){drag=undefined;box.classList.remove('is-dragging');guide.hidden=true;}};on(window,'pointerup',up);on(window,'pointercancel',up);on(box,'lostpointercapture',up);
  on(box,'dragstart',event=>event.preventDefault());
  on(box,'keydown',event=>{
    const move={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];if(!move||busy)return;event.preventDefault();const step=event.shiftKey?10:1;draft.x+=move[0]*step/cssViewportWidth()*100;draft.y+=move[1]*step;render();
  });
  on(root.querySelector('[data-reel-layout-save]'),'click',async()=>{
    if(busy)return;setBusy(true);status.textContent='保存中…';
    try{const next=structuredClone(settings);next.watchLayouts={...next.watchLayouts,[profile]:draft};const data=await request({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version,settings:next})});saved.textContent=showreelWatchLayoutCSS(data.settings.watchLayouts);close();}
    catch(error){status.textContent=error.message;}finally{setBusy(false);}
  });
  on(window,'resize',()=>{if(active){if(mode()!==profile)close();else render();}});on(document,'site:language-change',render);
  return ()=>{close();abort.abort();preview.remove();};
}
