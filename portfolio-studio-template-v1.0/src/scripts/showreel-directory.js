import {reelOffset,showreelArcLayout} from '../lib/showreel-navigation.js';

export function mountShowreelDirectory(host){
  const cards=[...host.querySelectorAll('[data-reel-card]')],dots=[...host.querySelectorAll('[data-reel-dot]')],directory=host.closest('.showreel-directory');
  if(!cards.length)return ()=>{};
  const abort=new AbortController(),{signal}=abort,on=(node,event,callback,options={})=>node.addEventListener(event,callback,{signal,...options});
  const reduced=matchMedia('(prefers-reduced-motion:reduce)');
  let position=0,target=0,frame=0,lastTime=0,layout,drag,blockClickUntil=0,wheelGate=0,wheelSum=0,lastWheel=0,selected=-1,disposed=false,readyFrame=0;
  host.removeAttribute('data-arc-ready');
  function draw(){
    const styles=getComputedStyle(host),height=Math.max(...cards.map(card=>card.offsetHeight));
    const gap=parseFloat(styles.getPropertyValue('--arc-card-gap'))||28,spacingScale=parseFloat(styles.getPropertyValue('--reel-spacing-scale'))||1;
    const number=(name,fallback)=>{const value=parseFloat(styles.getPropertyValue(name));return Number.isFinite(value)?value:fallback;};
    layout=showreelArcLayout(cards.length,position,host.clientWidth,host.clientHeight,height,gap,spacingScale,{
      cardWidth:cards[0].offsetWidth,cardScale:Math.max(.2,number('--reel-card-scale',1)),
      ringHeight:Math.max(100,number('--reel-ring-height',host.clientHeight*3.2)),
      centerY:host.clientHeight*number('--reel-ring-y',50)/100,
      anchorX:host.clientWidth*number('--reel-ring-x',50)/100
    });
    host.style.setProperty('--arc-radius',layout.radius+'px');host.style.setProperty('--arc-crest',layout.crest+'px');host.style.setProperty('--arc-center-y',layout.centerY+'px');
    for(const [index,card] of cards.entries()){
      const box=layout.cards[index];
      Object.assign(card.style,{left:box.x+'px',top:box.y+'px',transform:`translateY(-50%) rotate(${box.rotation}deg) scale(${box.scale})`,opacity:String(box.opacity)});
      if(dots[index])Object.assign(dots[index].style,{left:box.dotX+'px',top:box.dotY+'px',opacity:String(box.opacity)});
    }
    const next=((Math.round(position)%cards.length)+cards.length)%cards.length;
    if(next!==selected){selected=next;cards.forEach((card,index)=>card.classList.toggle('is-selected',index===selected));dots.forEach((dot,index)=>dot.classList.toggle('is-selected',index===selected));directory.querySelector('[data-reel-selection]').textContent=cards[selected].querySelector('.showreel-arc-year').textContent;host.dataset.selectedYear=cards[selected].dataset.year;}
  }
  function animate(time){
    const dt=Math.min(40,lastTime?time-lastTime:16);lastTime=time;
    position+=(target-position)*(1-Math.exp(-dt/85));
    if(Math.abs(target-position)<.001){position=target;frame=0;lastTime=0;draw();return;}
    draw();frame=requestAnimationFrame(animate);
  }
  function settle(next){
    target=next;cancelAnimationFrame(frame);frame=0;lastTime=0;
    if(reduced.matches){position=target;draw();}else frame=requestAnimationFrame(animate);
  }
  function step(direction){settle(Math.round(target)+direction);}
  on(host,'pointerdown',event=>{
    if(event.button!==0||drag)return;
    blockClickUntil=0;cancelAnimationFrame(frame);frame=0;
    drag={id:event.pointerId,startY:event.clientY,startPosition:position,lastPosition:position,lastTime:performance.now(),velocity:0,moved:false};
  });
  on(window,'pointermove',event=>{
    if(!drag||event.pointerId!==drag.id)return;
    if(!drag.moved&&Math.abs(event.clientY-drag.startY)<6)return;
    if(!drag.moved){drag.moved=true;host.setPointerCapture(event.pointerId);host.classList.add('is-dragging');}
    event.preventDefault();const now=performance.now();
    position=drag.startPosition-(event.clientY-drag.startY)/Math.max(60,layout.step);
    drag.velocity=(position-drag.lastPosition)/Math.max(8,now-drag.lastTime);drag.lastPosition=position;drag.lastTime=now;target=position;draw();
  },{passive:false});
  function endDrag(event){
    if(!drag||event.pointerId!==drag.id)return;
    const state=drag;drag=undefined;host.classList.remove('is-dragging');
    if(host.hasPointerCapture(event.pointerId))host.releasePointerCapture(event.pointerId);
    if(state.moved){blockClickUntil=performance.now()+400;const momentum=event.type==='pointercancel'||performance.now()-state.lastTime>100?0:Math.max(-.7,Math.min(.7,state.velocity*150));settle(Math.round(position+momentum));}
    else settle(Math.round(position));
  }
  on(window,'pointerup',endDrag);on(window,'pointercancel',endDrag);
  on(host,'lostpointercapture',event=>{if(drag)endDrag(event);});
  on(host,'click',event=>{if(event.detail>0&&performance.now()<blockClickUntil){event.preventDefault();event.stopPropagation();}},{capture:true});
  on(host,'dragstart',event=>event.preventDefault());
  on(host,'wheel',event=>{
    if(event.ctrlKey)return;event.preventDefault();const now=performance.now(),delta=event.deltaY||event.deltaX;
    if(!delta)return;
    if(now<wheelGate){wheelGate=now+180;lastWheel=now;wheelSum=0;return;}
    if(now-lastWheel>180||Math.sign(delta)!==Math.sign(wheelSum))wheelSum=0;
    lastWheel=now;wheelSum+=delta*(event.deltaMode===1?16:event.deltaMode===2?host.clientHeight:1);
    if(Math.abs(wheelSum)>=40){step(Math.sign(wheelSum));wheelSum=0;wheelGate=now+350;}
  },{passive:false});
  on(host,'keydown',event=>{
    const direction=['ArrowDown','ArrowRight'].includes(event.key)?1:['ArrowUp','ArrowLeft'].includes(event.key)?-1:0;
    if(direction){event.preventDefault();step(direction);}
    else if(event.key==='Home'||event.key==='End'){event.preventDefault();settle(event.key==='Home'?0:cards.length-1);}
  });
  for(const [index,card] of cards.entries())on(card,'focus',()=>settle(Math.round(position)+reelOffset(index,Math.round(position),cards.length)));
  for(const button of directory.querySelectorAll('[data-reel-step]'))on(button,'click',()=>step(Number(button.dataset.reelStep)));
  const resize=new ResizeObserver(()=>draw());resize.observe(host);cards.forEach(card=>resize.observe(card));draw();
  const images=cards.map(card=>card.querySelector('img')).filter(Boolean);
  Promise.allSettled([document.fonts?.ready,...images.map(img=>img.decode?.())]).then(()=>{
    if(disposed)return;
    readyFrame=requestAnimationFrame(()=>{if(disposed)return;draw();readyFrame=requestAnimationFrame(()=>{if(disposed)return;draw();host.setAttribute('data-arc-ready','');});});
  });
  return ()=>{disposed=true;abort.abort();resize.disconnect();cancelAnimationFrame(frame);cancelAnimationFrame(readyFrame);host.classList.remove('is-dragging');};
}
