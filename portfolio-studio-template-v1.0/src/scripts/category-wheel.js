// 分类滚轮的手感参数；时间单位为秒。
export const WHEEL_SETTINGS=Object.freeze({
  autoInterval:4,       // 无人操作时，每隔多久前进一格
  stepSeconds:.75,      // 自动前进一格的转动时间
  resumeDelay:3,        // 停止手动操作后，多久恢复自动滚动
  stiffness:200,       // 刻度吸附力度
  damping:24,          // 越大越稳，越小回弹越明显
  inertiaSeconds:.10,  // 松手时的惯性预测长度
  dragThreshold:5,     // 超过此像素距离才视为拖动，避免误跳转
  clickFeedbackSeconds:.14, // 点击变橙色后，稍等多久跳转
  wheelThreshold:40,       // 触控板滚动累计阈值（像素）
  wheelGestureGap:.16      // 连续触控板事件间隔超过此秒数，才算下一次手势
});
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const ease=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};
const modulo=(value,count)=>((value%count)+count)%count;

export function mountCategoryWheel(host) {
  const viewport=host.querySelector('[data-wheel-viewport]'),track=host.querySelector('[data-wheel-track]');
  const originals=[...track.querySelectorAll('[data-wheel-row]:not([data-wheel-initial-copy])')];
  if(!originals.length)return ()=>{};
  const count=originals.length;
  const items=originals.map(link=>({href:link.getAttribute('href'),slug:link.dataset.category,label:link.querySelector('[data-wheel-label]').textContent}));
  // Repeat whole cycles, including offscreen buffer rows, so the five visible
  // slots stay filled during forward/backward scrolling. Recycle beyond the mask.
  const rowCount=count*Math.max(3,Math.ceil(7/count));
  const rows=Array.from({length:rowCount},(_,i)=>originals[i%count].cloneNode(true));track.replaceChildren(...rows);
  rows.forEach((row,i)=>row.id=`category-wheel-row-${i}`);
  const announcement=host.querySelector('[data-wheel-announcement]');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let position=0,target=0,velocity=0,rowHeight=64,mode='idle',lastTime=0,raf=0,disposed=false;
  let feedbackTimer=0,navigationTimer=0,layoutEditing=false;
  let autoAt=performance.now()/1000+WHEEL_SETTINGS.autoInterval,autoStart=0,autoFrom=0;
  let hovering=false,focused=false,keyboardMode=false,visible=true,dragging=false,pointerId=null;
  let startY=0,startPosition=0,lastY=0,lastMoveTime=0,wheelBalance=0,suppressClickUntil=0;
  let wheelQueued=0,wheelLastTime=-Infinity,wheelDirection=0,wheelConsumed=false;
  let lastRendered=NaN,selected=-1,announceAfterSettle=false;
  const removals=[];
  const on=(node,event,fn,options)=>{node.addEventListener(event,fn,options);removals.push(()=>node.removeEventListener(event,fn,options));};
  const now=()=>performance.now()/1000;
  function deferAuto(){autoAt=now()+WHEEL_SETTINGS.resumeDelay;}
  const pointerRowHeight=()=>rowHeight*(viewport.getBoundingClientRect().height/viewport.offsetHeight||1);

  function render(force=false) {
    if(!force&&Math.abs(position-lastRendered)<.00001)return;
    lastRendered=position;
    const nearest=modulo(Math.round(position),count);
    // Integer positions put the selected row exactly at the fixed center pointer.
    const before=rowCount/2;
    const distances=rows.map((_,i)=>modulo(i-position+before,rowCount)-before);
    // Only one copy per category participates in keyboard/screen-reader navigation.
    const representatives=items.map((_,category)=>distances.reduce((best,distance,i)=>
      i%count===category&&(best<0||Math.abs(distance)<Math.abs(distances[best]))?i:best,-1));
    rows.forEach((row,i)=>{
      const distance=distances[i],representative=representatives[i%count]===i;
      row.style.transform=`translate3d(0,${distance*rowHeight}px,0)`;
      row.style.setProperty('--wheel-depth',String(Math.min(1,Math.abs(distance)/2.5)));
      const current=i%count===nearest&&representative;
      row.classList.toggle('is-selected',current);row.tabIndex=representative?0:-1;
      if(representative)row.removeAttribute('aria-hidden');else row.setAttribute('aria-hidden','true');
      if(current)row.setAttribute('aria-current','true');else row.removeAttribute('aria-current');
    });
    selected=modulo(nearest,count);host.dataset.selectedCategory=items[selected].slug;
  }

  function clearFeedback(){
    clearTimeout(feedbackTimer);clearTimeout(navigationTimer);
    rows.forEach(row=>row.classList.remove('is-pressed','is-clicked'));
  }

  function settle(destination,manual=true) {
    target=Math.round(destination);announceAfterSettle=manual;mode='settle';deferAuto();
    if(reduced.matches){position=target;velocity=0;mode='idle';render();if(manual)announcement.textContent=items[modulo(target,count)].label;}
  }
  function release(event) {
    if(pointerId===null||(event?.pointerId!==undefined&&event.pointerId!==pointerId))return;
    const id=pointerId,wasDragging=dragging;pointerId=null;dragging=false;host.classList.remove('is-dragging');
    if(viewport.hasPointerCapture(id))viewport.releasePointerCapture(id);
    rows.forEach(row=>row.classList.remove('is-pressed'));
    if(wasDragging){clearFeedback();suppressClickUntil=now()+.35;velocity=clamp(velocity,-8,8);settle(position+velocity*WHEEL_SETTINGS.inertiaSeconds);}
    else{velocity=0;settle(position,false);}
  }
  function resize(){
    const style=getComputedStyle(viewport);
    rowHeight=parseFloat(style.getPropertyValue('--wheel-row-height'))||64;
    render(true);
  }
  function frame(timestamp) {
    if(disposed)return;
    const time=timestamp/1000,dt=lastTime?Math.min(time-lastTime,1/30):0;lastTime=time;
    if(!document.hidden&&visible&&!layoutEditing){
      if(mode==='settle'){
        velocity+=((target-position)*WHEEL_SETTINGS.stiffness-velocity*WHEEL_SETTINGS.damping)*dt;
        position+=velocity*dt;
        if(Math.abs(target-position)<.0005&&Math.abs(velocity)<.005){
          position=target;velocity=0;mode='idle';deferAuto();
          if(announceAfterSettle)announcement.textContent=items[modulo(target,count)].label;
          announceAfterSettle=false;
          if(wheelQueued){const direction=Math.sign(wheelQueued);wheelQueued-=direction;settle(position+direction);}
        }
      }else if(mode==='auto'){
        const progress=(time-autoStart)/WHEEL_SETTINGS.stepSeconds;
        position=autoFrom+ease(progress);
        if(progress>=1){position=autoFrom+1;target=position;mode='idle';autoAt=autoStart+WHEEL_SETTINGS.autoInterval;}
      }else if(mode==='idle'&&!hovering&&!focused&&pointerId===null&&!reduced.matches&&time>=autoAt){
        mode='auto';autoStart=time;autoFrom=Math.round(position);
      }
      render();
    }
    raf=requestAnimationFrame(frame);
  }

  on(host,'home:layout-edit',event=>{
    layoutEditing=!!event.detail?.active;release();clearFeedback();wheelQueued=0;velocity=0;
    position=target=Math.round(position);mode='idle';deferAuto();render(true);
  });
  on(viewport,'pointerenter',event=>{if(event.pointerType==='touch')return;hovering=true;deferAuto();if(mode==='auto'){velocity=0;settle(position,false);}});
  on(viewport,'pointerleave',event=>{if(event.pointerType==='touch')return;hovering=false;deferAuto();});
  on(viewport,'pointerdown',event=>{
    if(event.button!==0||pointerId!==null)return;
    wheelQueued=0;wheelBalance=0;wheelConsumed=false;
    clearFeedback();event.target.closest?.('[data-wheel-row]')?.classList.add('is-pressed');
    pointerId=event.pointerId;startY=lastY=event.clientY;startPosition=position;lastMoveTime=now();velocity=0;mode='hold';deferAuto();
  });
  on(window,'pointermove',event=>{
    if(event.pointerId!==pointerId)return;
    const dy=event.clientY-startY,time=now(),elapsed=Math.max(.008,time-lastMoveTime),unit=pointerRowHeight();
    if(!dragging&&Math.abs(dy)>WHEEL_SETTINGS.dragThreshold){clearFeedback();dragging=true;viewport.setPointerCapture(pointerId);host.classList.add('is-dragging');viewport.focus({preventScroll:true});}
    if(dragging){
      const next=startPosition-dy/unit;
      velocity=.65*velocity+.35*(-(event.clientY-lastY)/unit/elapsed);
      position=next;mode='drag';render();
      if(event.cancelable)event.preventDefault();
    }
    lastY=event.clientY;lastMoveTime=time;
  },{passive:false});
  on(window,'pointerup',release);on(window,'pointercancel',release);
  // Touch starts with implicit capture on the clicked text/link. Transferring
  // it to the viewport emits a bubbling loss on that child, not a lost drag.
  on(viewport,'lostpointercapture',event=>{if(event.target===viewport)release(event);});
  on(host,'click',event=>{
    if(dragging||now()<suppressClickUntil){event.preventDefault();event.stopPropagation();return;}
    const link=event.target.closest?.('[data-wheel-row]');if(!link)return;
    clearFeedback();link.classList.add('is-clicked');
    const delay=WHEEL_SETTINGS.clickFeedbackSeconds*1000;
    if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||(link.target&&link.target!=='_self')){
      feedbackTimer=setTimeout(clearFeedback,delay);return;
    }
    event.preventDefault();velocity=0;mode='hold';const href=link.href;
    navigationTimer=setTimeout(()=>window.location.assign(href),delay);
  },{capture:true});
  on(viewport,'dragstart',event=>event.preventDefault());
  on(viewport,'wheel',event=>{
    if(event.ctrlKey||Math.abs(event.deltaX)>Math.abs(event.deltaY))return;
    event.preventDefault();deferAuto();
    const time=now(),direction=Math.sign(event.deltaY);
    if(!direction)return;
    // 鼠标一格常为 100/120px，不能按像素除以阈值变成两格。
    const discrete=event.deltaMode!==0||(Math.abs(event.deltaY)>=100&&event.deltaY%20===0);
    if(discrete||time-wheelLastTime>WHEEL_SETTINGS.wheelGestureGap||direction!==wheelDirection){wheelBalance=0;wheelConsumed=false;}
    wheelLastTime=time;wheelDirection=direction;
    if(wheelConsumed)return;
    wheelBalance+=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?viewport.clientHeight:1);
    if(discrete||Math.abs(wheelBalance)>=WHEEL_SETTINGS.wheelThreshold){
      wheelConsumed=true;wheelBalance=0;
      if(mode==='settle')wheelQueued=clamp(wheelQueued+direction,-5,5);
      else{velocity=0;settle(Math.round(position)+direction);}
    }
  },{passive:false});
  on(viewport,'keydown',event=>{
    if(event.key==='ArrowUp'||event.key==='ArrowDown'){
      event.preventDefault();keyboardMode=true;focused=true;viewport.focus({preventScroll:true});velocity=0;
      wheelQueued=0;
      settle((mode==='settle'?target:Math.round(position))+(event.key==='ArrowDown'?1:-1));
    }else if(event.key==='Enter'&&event.target===viewport){event.preventDefault();rows.find(row=>row.classList.contains('is-selected'))?.click();}
  });
  on(window,'keydown',event=>{if(event.key==='Tab')keyboardMode=true;});
  on(window,'pointerdown',()=>{keyboardMode=false;focused=false;deferAuto();});
  on(host,'focusin',event=>{
    focused=keyboardMode;deferAuto();
    if(keyboardMode){
      const row=event.target.closest?.('[data-wheel-row]');
      if(row){
        const index=rows.indexOf(row);position+=modulo(index-position+count/2,count)-count/2;
        target=position;velocity=0;mode='idle';render(true);
      }else if(mode==='auto'||mode==='settle'){
        position=Math.round(position);target=position;velocity=0;mode='idle';render(true);
      }
    }
  });
  on(host,'focusout',event=>{if(!host.contains(event.relatedTarget)){focused=false;deferAuto();}});
  on(window,'blur',()=>{release();deferAuto();});
  on(window,'pageshow',()=>{
    lastTime=0;clearFeedback();
    if(mode==='hold'&&pointerId===null){velocity=0;settle(position,false);}
    deferAuto();
  });
  on(document,'visibilitychange',()=>{lastTime=0;deferAuto();if(document.hidden)release();});
  on(reduced,'change',()=>{release();velocity=0;settle(position,false);});
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(viewport);
  const intersectionObserver=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;lastTime=0;deferAuto();});intersectionObserver.observe(host);
  host.classList.add('is-ready');resize();raf=requestAnimationFrame(frame);
  const debug={snapshot:()=>({position,target,velocity,mode,dragging,rowHeight,edgeOpacity:parseFloat(getComputedStyle(viewport).getPropertyValue('--wheel-edge-opacity')),selected:selected<0?null:items[selected].slug,selectedLabel:selected<0?null:items[selected].label,reducedMotion:reduced.matches,hovering,focused})};
  if(import.meta.env.DEV)host.__categoryWheel=debug;
  return ()=>{
    if(disposed)return;disposed=true;cancelAnimationFrame(raf);clearFeedback();removals.forEach(remove=>remove());resizeObserver.disconnect();intersectionObserver.disconnect();
    if(pointerId!==null&&viewport.hasPointerCapture(pointerId))viewport.releasePointerCapture(pointerId);
    track.replaceChildren(...originals);host.classList.remove('is-dragging');delete host.dataset.selectedCategory;
    if(host.__categoryWheel===debug)delete host.__categoryWheel;
  };
}
