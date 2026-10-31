import {initialShowreelIndex,showreelWatchTransition} from '../lib/showreel-navigation.js';
export function mountShowreel(host){
 host.dispatchEvent(new Event('showreel:mounted'));
 const panels=[...host.querySelectorAll('[data-showreel-year]')],videos=panels.map(panel=>panel.querySelector('video'));
 const abort=new AbortController(),{signal}=abort,on=(node,event,fn,extra={})=>node.addEventListener(event,fn,{signal,...extra});
 const reduced=matchMedia('(prefers-reduced-motion:reduce)');
 const prepared=new WeakSet();
 const years=panels.map(panel=>panel.dataset.showreelYear),yearButtons=[...document.querySelectorAll('[data-watch-year]')];
 let index=initialShowreelIndex(years,location.search),animation=0,scrollFrame=0,animating=false,gateUntil=0,lastWheel=0,accumulated=0,physicalOrder=panels.map((_,i)=>i),touch;
 function activate(next){
  index=Math.max(0,Math.min(panels.length-1,next));host.dataset.activeYear=panels[index].dataset.showreelYear;
  for(const button of yearButtons){if(button.dataset.watchYear===years[index])button.setAttribute('aria-current','true');else button.removeAttribute('aria-current');}
  const url=new URL(location.href);if(url.searchParams.get('year')!==years[index]){url.searchParams.set('year',years[index]);history.replaceState(history.state,'',url);}
  videos.forEach((video,i)=>{if(i!==index)video.pause();});
  const video=videos[index];
  if(!prepared.has(video)){prepared.add(video);video.preload='metadata';if(!video.readyState&&(video.getAttribute('src')||video.querySelector('source')))video.load();}
 }
 function restoreOrder(){
  if(!physicalOrder.some((value,i)=>value!==i))return;
  panels.forEach(panel=>panel.style.removeProperty('transform'));physicalOrder=panels.map((_,i)=>i);host.scrollTop=index*host.clientHeight;
 }
 function nearestIndex(){return physicalOrder[Math.max(0,Math.min(panels.length-1,Math.round(host.scrollTop/host.clientHeight)))];}
 function stop(){cancelAnimationFrame(animation);restoreOrder();animating=false;host.classList.remove('is-transitioning');}
 function go(next,smooth=true){
  stop();const transition=showreelWatchTransition(index,next,panels.length);activate(transition.index);
  if(smooth&&!reduced.matches&&transition.order.some((value,i)=>value!==i)){
   host.classList.add('is-transitioning');physicalOrder=transition.order;
   panels.forEach((panel,i)=>{panel.style.transform=`translateY(${(physicalOrder.indexOf(i)-i)*100}%)`;});
   host.scrollTop=transition.from*host.clientHeight;
  }
  const from=host.scrollTop,to=(smooth&&!reduced.matches?transition.to:index)*host.clientHeight;
  if(!smooth||reduced.matches||Math.abs(from-to)<1){host.scrollTop=to;return;}
  animating=true;host.classList.add('is-transitioning');const start=performance.now(),duration=700;
  function tick(now){
   const progress=Math.max(0,Math.min(1,(now-start)/duration)),ease=1-Math.pow(1-progress,4);host.scrollTop=from+(to-from)*ease;
   if(progress<1)animation=requestAnimationFrame(tick);
   else{host.scrollTop=to;restoreOrder();animating=false;host.classList.remove('is-transitioning');gateUntil=Math.max(gateUntil,now+160);}
  }
  animation=requestAnimationFrame(tick);
 }
 on(host,'wheel',event=>{
  if(event.ctrlKey||Math.abs(event.deltaX)>Math.abs(event.deltaY)||!event.deltaY||document.fullscreenElement)return;
  event.preventDefault();const now=performance.now();
  if(animating||now<gateUntil){gateUntil=now+180;lastWheel=now;accumulated=0;return;}
  const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?host.clientHeight:1);
  if(now-lastWheel>180||Math.sign(delta)!==Math.sign(accumulated))accumulated=0;
  lastWheel=now;accumulated+=delta;
  if(Math.abs(accumulated)>=45){const next=index+Math.sign(accumulated);accumulated=0;gateUntil=now+180;go(next);}
 },{passive:false});
 on(host,'keydown',event=>{
  if(event.target.closest('video,button,input,textarea,select,[contenteditable]'))return;
  const next=['ArrowDown','PageDown'].includes(event.key)?index+1:['ArrowUp','PageUp'].includes(event.key)?index-1:event.key==='Home'?0:event.key==='End'?panels.length-1:null;
  if(next!==null){event.preventDefault();go(next);}
 });
 on(host,'scroll',()=>{
  if(animating)return;cancelAnimationFrame(scrollFrame);scrollFrame=requestAnimationFrame(()=>{if(!animating&&host.clientHeight)activate(Math.round(host.scrollTop/host.clientHeight));});
 },{passive:true});
 on(host,'pointerdown',()=>{if(animating){const nearest=nearestIndex();stop();activate(nearest);host.scrollTop=index*host.clientHeight;}});
 on(host,'touchstart',event=>{
  touch=undefined;if(animating||event.touches.length!==1)return;
  const edge=host.scrollTop<=1?-1:host.scrollTop>=(panels.length-1)*host.clientHeight-1?1:0;
  if(edge)touch={x:event.touches[0].clientX,y:event.touches[0].clientY,edge};
 },{passive:true});
 on(host,'touchmove',event=>{
  if(!touch||event.touches.length!==1)return;
  const dy=touch.y-event.touches[0].clientY,dx=touch.x-event.touches[0].clientX;
  if(Math.sign(dy)===touch.edge&&Math.abs(dy)>8&&Math.abs(dy)>Math.abs(dx))event.preventDefault();
 },{passive:false});
 on(host,'touchend',event=>{
  const start=touch;touch=undefined;if(!start||!event.changedTouches.length)return;
  const dy=start.y-event.changedTouches[0].clientY,dx=start.x-event.changedTouches[0].clientX;
  if(Math.sign(dy)===start.edge&&Math.abs(dy)>=45&&Math.abs(dy)>Math.abs(dx)){gateUntil=performance.now()+180;go(index+start.edge);}
 },{passive:true});
 on(host,'touchcancel',()=>{touch=undefined;},{passive:true});
 on(document,'visibilitychange',()=>{if(document.hidden)videos.forEach(video=>video.pause());});
 on(window,'pagehide',()=>videos.forEach(video=>video.pause()));
 on(window,'pageshow',event=>{if(event.persisted)go(index,false);});
 for(const button of yearButtons)on(button,'click',()=>go(years.indexOf(button.dataset.watchYear)));
 let lastHeight=0;
 const resize=new ResizeObserver(()=>{if(host.clientHeight!==lastHeight){lastHeight=host.clientHeight;go(index,false);}});resize.observe(host);
 go(index,false);
 return ()=>{abort.abort();resize.disconnect();cancelAnimationFrame(scrollFrame);stop();videos.forEach(video=>video.pause());};
}
