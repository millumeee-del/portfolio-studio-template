import {DEFAULT_ABOUT_PORTRAIT,validPortraitPoints,validateAboutPortrait,aboutPortraitStyle} from '../lib/about-portrait.js';
import {ABOUT_TEXT_REFERENCE,getAboutTextBlocks,aboutTextStyle,aboutTextPageStyle} from '../lib/about-text.js';
import {about} from '../data/about.js';

let dispose;
function mount(){
  dispose?.();
  const host=document.querySelector('[data-about-portrait-editor]');if(!host)return;
  const frame=host.closest('[data-about-portrait]'),page=host.closest('[data-about-page]');
  const abort=new AbortController(),{signal}=abort,on=(node,event,callback)=>node.addEventListener(event,callback,{signal});
  const $=selector=>document.querySelector(selector),entry=$('[data-about-edit-open]'),overlay=$('[data-about-shape-overlay]'),toolbar=$('[data-about-shape-toolbar]'),status=$('[data-about-edit-status]'),parent=toolbar.parentElement;
  document.body.append(entry,toolbar);
  const normalize=layout=>validateAboutPortrait({...layout,textBlocks:getAboutTextBlocks(layout,about)});
  let original=normalize(JSON.parse(frame.dataset.portraitLayout)),draft=structuredClone(original),version,active=false,busy=false,drag=null,selected=original.textBlocks[0]?.id??'';
  const history=[],corners=[...host.querySelectorAll('[data-about-corner]')],fields=[...toolbar.querySelectorAll('[data-about-field]')],guides={};
  const profile=()=>matchMedia('(max-width:700px)').matches?'mobile':'desktop';
  let lastProfile=profile();
  const block=id=>draft.textBlocks.find(item=>item.id===id);
  const target=id=>id==='portrait'?frame:[...page.querySelectorAll('[data-about-block]')].find(node=>node.dataset.aboutBlock===id);
  const reference=id=>id==='portrait'?draft.positions[profile()].referenceWidth:ABOUT_TEXT_REFERENCE[profile()];
  const hint='点击文本直接打字；拖动各框上方标签移动，蓝色手柄调大小。粉色线表示吸附，Alt 暂停吸附。';
  function message(text,error=false){status.textContent=text;status.classList.toggle('is-error',error);}
  function remember(){history.push(structuredClone(draft));if(history.length>60)history.shift();}
  function hideGuides(){for(const line of Object.values(guides))line.hidden=true;for(const axis of ['x','y'])$('[data-about-guide-'+axis+']').hidden=true;}
  function parameters(expanded){toolbar.querySelector('.about-shape-fields').hidden=!expanded;status.hidden=!expanded;$('[data-about-collapse]').textContent=expanded?'收起参数':'展开参数';}
  function controls(node,id){
    if(node.querySelector(':scope > .about-move-frame'))return;
    const box=document.createElement('div');box.className='about-move-frame';box.dataset.aboutMove=id;box.hidden=!active;
    const label=document.createElement('button');label.type='button';label.className='about-move-label';label.dataset.aboutDrag=id;box.append(label);
    for(const handle of ['e','s','se']){const knob=document.createElement('button');knob.type='button';knob.className='about-resize-handle';knob.dataset.aboutResize=id;knob.dataset.handle=handle;knob.setAttribute('aria-label',`调整${id==='portrait'?'头像':'文本框'}${handle==='e'?'宽度':handle==='s'?'高度':'大小'}`);box.append(knob);}
    node.append(box);
  }
  function renderBlocks(){
    const ids=new Set(draft.textBlocks.map(item=>item.id));
    for(const node of page.querySelectorAll('[data-about-block]'))if(!ids.has(node.dataset.aboutBlock))node.remove();
    for(const [index,item] of draft.textBlocks.entries()){
      let node=target(item.id);
      if(!node){node=document.createElement('div');node.className='about-text-block';node.dataset.aboutBlock=item.id;const text=document.createElement('div');text.className='about-text-content';text.dataset.aboutBlockContent='';node.append(text);page.append(node);}
      node.setAttribute('style',aboutTextStyle(item));node.classList.toggle('is-selected',active&&selected===item.id);
      const text=node.querySelector('[data-about-block-content]');
      if(document.activeElement!==text||!active)text.textContent=item.text;
      if(active&&!busy){text.setAttribute('contenteditable','plaintext-only');text.setAttribute('role','textbox');text.setAttribute('aria-label','文本框 '+(index+1));text.dataset.placeholder='点击输入文字';}
      else{for(const attr of ['contenteditable','role','aria-label'])text.removeAttribute(attr);}
      let link=node.querySelector('.about-text-link');
      if(item.href&&!active){if(!link){link=document.createElement('a');link.className='about-text-link';node.append(link);}link.href=item.href;link.setAttribute('aria-label',item.text);link.rel='noopener noreferrer';if(item.href.startsWith('http'))link.target='_blank';else link.removeAttribute('target');}else link?.remove();
      controls(node,item.id);node.querySelector('.about-move-frame').hidden=!active;
      const label=node.querySelector('[data-about-drag]');label.textContent='文本 '+(index+1)+' · 拖动移动';label.setAttribute('aria-label','移动文本框 '+(index+1));
    }
  }
  function renderPanel(){
    if(!block(selected))selected=draft.textBlocks[0]?.id??'';
    const select=$('[data-about-selected]');
    if(document.activeElement!==select){select.replaceChildren(...draft.textBlocks.map((item,index)=>{const option=document.createElement('option');option.value=item.id;option.textContent='文本 '+(index+1)+' · '+(item.text.slice(0,14)||'空白');return option;}));select.value=selected;}
    const item=block(selected);$('[data-about-text-settings]').hidden=!item;
    if(item){
      const values={'[data-about-text-value]':item.text,'[data-about-text-weight]':item.fontWeight,'[data-about-text-line]':item.lineHeight,'[data-about-text-href]':item.href};
      for(const [selector,value] of Object.entries(values)){const field=$(selector);if(document.activeElement!==field)field.value=String(value);}
      for(const field of toolbar.querySelectorAll('[data-about-text-param]'))if(document.activeElement!==field)field.value=String(item[profile()][field.dataset.aboutTextParam]);
    }
    for(const field of fields)if(document.activeElement!==field)field.value=String(draft[field.dataset.aboutField]);
    $('[data-about-undo]').disabled=busy||!history.length;
    $('[data-about-profile]').textContent='About 排版 · '+(profile()==='mobile'?'手机':'电脑');
  }
  function render(){
    const image=frame.querySelector('.about-portrait-mask img'),src=draft.imageSrc||'/contacts/avatar.png';
    if(image.getAttribute('src')!==src)image.src=src;
    page.setAttribute('style',aboutPortraitStyle(draft)+aboutTextPageStyle(draft.textBlocks));renderBlocks();renderPanel();
    $('[data-about-shape-outline]').setAttribute('points',draft.points.map(point=>point.join(',')).join(' '));
    for(const [index,corner] of corners.entries()){corner.style.left=draft.points[index][0]+'%';corner.style.top=draft.points[index][1]+'%';}
    controls(frame,'portrait');frame.querySelector('.about-move-frame').hidden=!active;
    frame.querySelector('[data-about-drag]').textContent='头像 · 拖动移动';
  }
  function setBusy(value){busy=value;entry.disabled=value;for(const node of toolbar.querySelectorAll('button,input,textarea,select'))node.disabled=value;render();}
  async function request(method,payload){const result=await fetch('/__portfolio-editor/about-portrait',{method,signal,headers:{'Content-Type':'application/json'},...(payload?{body:JSON.stringify(payload)}:{})}),data=await result.json();if(!result.ok)throw new Error(data.error||'保存失败');return data;}
  function close(restore=true){if(busy)return;if(restore)draft=structuredClone(original);active=false;drag=null;history.length=0;hideGuides();render();overlay.hidden=true;toolbar.hidden=true;entry.hidden=false;document.body.classList.remove('is-about-shape-editing');}
  on(entry,'click',async()=>{if(active||busy)return;setBusy(true);try{const data=await request('GET');original=normalize(data.layout);draft=structuredClone(original);version=data.version;active=true;history.length=0;entry.hidden=true;toolbar.hidden=false;overlay.hidden=false;document.body.classList.add('is-about-shape-editing');parameters(profile()!=='mobile');message(hint);}catch(error){toolbar.hidden=false;message(error.message,true);}finally{setBusy(false);}});
  on($('[data-about-collapse]'),'click',()=>parameters(toolbar.querySelector('.about-shape-fields').hidden));
  on($('[data-about-image]'),'change',async event=>{
    const file=event.target.files?.[0];if(!file||busy||!active)return;
    if(!/\.(png|jpe?g|webp|gif|avif)$/i.test(file.name))return message('请选择图片文件',true);
    setBusy(true);message('正在读取头像…');
    try{
      const response=await fetch('/__portfolio-editor/upload',{method:'POST',headers:{'x-file-name':encodeURIComponent(file.name)},body:file,signal}),data=await response.json();
      if(!response.ok)throw new Error(data.error||'图片上传失败');
      remember();draft.imageSrc=data.src;message('头像已替换，点击「保存排版」生效。');
    }catch(error){message(error.message,true);}finally{event.target.value='';setBusy(false);}
  });
  on($('[data-about-selected]'),'change',event=>{selected=event.target.value;render();});
  function selectBlock(node){selected=node.dataset.aboutBlock;for(const box of page.querySelectorAll('[data-about-block]'))box.classList.toggle('is-selected',box===node);renderPanel();}
  on(page,'focusin',event=>{const node=event.target.closest('[data-about-block]');if(active&&node)selectBlock(node);});
  function changeText(edit){if(!active||busy)return;const next=structuredClone(draft),item=next.textBlocks.find(item=>item.id===selected);if(!item)return;try{edit(item);const valid=validateAboutPortrait(next);remember();draft=valid;render();message(hint);}catch(error){message(error.message,true);}}
  on(page,'input',event=>{const text=event.target.closest('[data-about-block-content]');if(!text)return;selected=text.closest('[data-about-block]').dataset.aboutBlock;changeText(item=>{item.text=text.innerText.replace(/\r\n?/g,'\n');});});
  on($('[data-about-text-value]'),'input',event=>changeText(item=>{item.text=event.target.value;}));
  for(const field of toolbar.querySelectorAll('[data-about-text-param]'))on(field,'input',()=>changeText(item=>{item[profile()][field.dataset.aboutTextParam]=Number(field.value);}));
  on($('[data-about-text-weight]'),'change',event=>changeText(item=>{item.fontWeight=Number(event.target.value);}));
  on($('[data-about-text-line]'),'input',event=>changeText(item=>{item.lineHeight=Number(event.target.value);}));
  on($('[data-about-text-href]'),'change',event=>changeText(item=>{item.href=event.target.value.trim();}));
  on($('[data-about-add-text]'),'click',()=>{
    if(!active||busy)return;if(draft.textBlocks.length>=40)return message('最多添加 40 个文本框',true);
    remember();const base=block(selected),id='text-'+crypto.randomUUID().slice(0,12);
    const item={id,text:'',fontWeight:400,lineHeight:1.6,href:'',desktop:{x:520,y:120,width:440,height:60,fontSize:18},mobile:{x:0,y:700,width:440,height:60,fontSize:18}};
    for(const p of ['desktop','mobile'])item[p]={...(base?.[p]??item[p]),y:Math.min(5800,Math.max(80,...draft.textBlocks.map(b=>b[p].y+b[p].height))+32),height:60,fontSize:18};
    draft.textBlocks.push(item);selected=id;render();target(id).querySelector('[data-about-block-content]').focus();
  });
  on($('[data-about-remove-text]'),'click',()=>{if(!active||busy||!block(selected))return;remember();draft.textBlocks=draft.textBlocks.filter(item=>item.id!==selected);selected='';render();});
  for(const field of fields)on(field,'input',()=>{if(!active||busy)return;try{const next=validateAboutPortrait({...draft,[field.dataset.aboutField]:Number(field.value)});remember();draft=next;render();message(hint);}catch(error){message(error.message,true);}});
  for(const axis of ['x','y']){const line=document.createElement('div');line.className='about-position-snap about-position-snap-'+axis;line.hidden=true;page.append(line);guides[axis]=line;}
  function bounds(){const rect=page.getBoundingClientRect(),main=document.querySelector('.portfolio-main').getBoundingClientRect(),nav=document.querySelector('.site-nav').getBoundingClientRect();return {left:main.left-rect.left+8,right:document.documentElement.clientWidth-rect.left-8,top:nav.bottom+10-rect.top};}
  function position(id){const rect=target(id).getBoundingClientRect(),area=page.getBoundingClientRect();return {x:rect.left-area.left,y:rect.top-area.top,width:rect.width,height:rect.height};}
  function move(id,x,y,snap=true){
    const area=bounds(),box=position(id),scale=page.clientWidth/reference(id);
    x=Math.max(area.left,Math.min(area.right-box.width,x));y=Math.max(area.top,Math.min(5000*scale,y));hideGuides();
    if(snap){const others=[frame,...page.querySelectorAll('[data-about-block]')].filter(node=>node!==target(id)).map(node=>{const r=node.getBoundingClientRect(),p=page.getBoundingClientRect();return {x:r.x-p.x,y:r.y-p.y,width:r.width,height:r.height};});
      for(const [axis,size,targets] of [['x','width',[area.left,(area.left+area.right)/2,area.right,...others.flatMap(b=>[b.x,b.x+b.width/2,b.x+b.width])]],['y','height',[area.top,...others.flatMap(b=>[b.y,b.y+b.height/2,b.y+b.height])]]]){
        let best=null;const value=axis==='x'?x:y;
        for(const edge of [0,box[size]/2,box[size]])for(const guide of targets){const delta=guide-value-edge;if(Math.abs(delta)<=6&&(!best||Math.abs(delta)<Math.abs(best.delta)))best={delta,guide};}
        if(best){if(axis==='x')x+=best.delta;else y+=best.delta;Object.assign(guides[axis].style,axis==='x'?{left:best.guide+'px',top:area.top+'px',height:Math.max(page.scrollHeight,innerHeight)+'px'}:{top:best.guide+'px',left:area.left+'px',width:area.right-area.left+'px'});guides[axis].hidden=false;}
      }
    }
    x=Math.max(area.left,Math.min(area.right-box.width,x));y=Math.max(area.top,y);
    if(id==='portrait'){const base={x:frame.parentElement.offsetLeft+frame.offsetLeft,y:frame.parentElement.offsetTop+frame.offsetTop};draft.positions[profile()].portrait={x:(x-base.x)/scale,y:(y-base.y)/scale};}
    else Object.assign(block(id)[profile()],{x:x/scale,y:y/scale});
    render();
  }
  function resize(id,width,height){
    if(id==='portrait'){draft.width=Math.max(160,Math.min(760,width));draft.height=Math.max(160,Math.min(900,height));}
    else Object.assign(block(id)[profile()],{width:Math.max(60,Math.min(1600,width)),height:Math.max(24,Math.min(2400,height))});
    render();
  }
  on(page,'pointerdown',event=>{
    if(!active||busy||event.button!==0)return;
    const control=event.target.closest('[data-about-drag],[data-about-resize]');if(!control){const node=event.target.closest('[data-about-block]');if(node)selectBlock(node);return;}
    event.preventDefault();event.stopPropagation();const id=control.dataset.aboutDrag??control.dataset.aboutResize;if(id!=='portrait')selected=id;
    remember();const rect=position(id),geo=id==='portrait'?{width:draft.width,height:draft.height}:block(id)[profile()];
    drag={pointer:event.pointerId,id,type:control.hasAttribute('data-about-resize')?'resize':'move',handle:control.dataset.handle,startX:event.clientX,startY:event.clientY,rect,width:geo.width,height:geo.height,scale:rect.width/geo.width};control.setPointerCapture(event.pointerId);control.focus({preventScroll:true});renderPanel();
  });
  on(page,'pointermove',event=>{if(!drag||drag.pointer!==event.pointerId)return;const dx=event.clientX-drag.startX,dy=event.clientY-drag.startY;if(drag.type==='move')move(drag.id,drag.rect.x+dx,drag.rect.y+dy,!event.altKey);else resize(drag.id,drag.width+(drag.handle.includes('e')?dx/drag.scale:0),drag.height+(drag.handle.includes('s')?dy/drag.scale:0));});
  const end=()=>{drag=null;hideGuides();};on(page,'pointerup',end);on(page,'pointercancel',end);on(page,'lostpointercapture',end);
  on(page,'keydown',event=>{
    const control=event.target.closest('[data-about-drag],[data-about-resize]'),dir={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];if(!control||!dir||!active||busy)return;
    event.preventDefault();remember();const id=control.dataset.aboutDrag??control.dataset.aboutResize,step=event.shiftKey?10:1;
    if(control.hasAttribute('data-about-drag')){const rect=position(id);move(id,rect.x+dir[0]*step,rect.y+dir[1]*step,false);}
    else{const box=id==='portrait'?draft:block(id)[profile()],handle=control.dataset.handle;resize(id,box.width+(handle.includes('e')?dir[0]*step:0),box.height+(handle.includes('s')?dir[1]*step:0));}
  });
  function changeCorner(index,x,y){const points=structuredClone(draft.points);points[index]=[Math.max(0,Math.min(100,x)),Math.max(0,Math.min(100,y))];if(!validPortraitPoints(points))return;draft.points=points;render();}
  for(const [index,corner] of corners.entries()){
    let pointer=null;
    on(corner,'pointerdown',event=>{if(!active||busy||event.button!==0)return;event.preventDefault();remember();pointer=event.pointerId;corner.setPointerCapture(pointer);});
    on(corner,'pointermove',event=>{if(pointer!==event.pointerId)return;const rect=frame.getBoundingClientRect();let x=(event.clientX-rect.left)/rect.width*100,y=(event.clientY-rect.top)/rect.height*100;hideGuides();if(!event.altKey){for(const axis of ['x','y']){const value=axis==='x'?x:y,size=axis==='x'?rect.width:rect.height,targets=[0,50,100,...draft.points.filter((_,i)=>i!==index).map(p=>p[axis==='x'?0:1])];let nearest=targets.filter(n=>Math.abs(n-value)*size/100<=6).sort((a,b)=>Math.abs(a-value)-Math.abs(b-value))[0];if(nearest!==undefined){if(axis==='x')x=nearest;else y=nearest;const line=$('[data-about-guide-'+axis+']');line.style[axis==='x'?'left':'top']=nearest+'%';line.hidden=false;}}}changeCorner(index,x,y);});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])on(corner,event,()=>{pointer=null;hideGuides();});
    on(corner,'keydown',event=>{const dir={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];if(!dir||!active||busy)return;event.preventDefault();remember();const step=event.shiftKey?2:.25;changeCorner(index,draft.points[index][0]+dir[0]*step,draft.points[index][1]+dir[1]*step);});
  }
  on($('[data-about-rectangle]'),'click',()=>{remember();draft.points=[[0,0],[100,0],[100,100],[0,100]];render();});
  on($('[data-about-reference]'),'click',()=>{remember();draft.points=structuredClone(DEFAULT_ABOUT_PORTRAIT.points);render();});
  on($('[data-about-undo]'),'click',()=>{if(!history.length||busy)return;draft=history.pop();render();hideGuides();});
  on($('[data-about-cancel]'),'click',()=>{close();entry.focus({preventScroll:true});});
  on($('[data-about-save]'),'click',async()=>{if(busy||!active)return;setBusy(true);try{const data=await request('POST',{version,layout:validateAboutPortrait(draft)});if(!Array.isArray(data.layout.textBlocks))throw new Error('保存服务尚未更新，请重启本地服务器后重试');original=normalize(data.layout);draft=structuredClone(original);version=data.version;frame.dataset.portraitLayout=JSON.stringify(original);setBusy(false);close(false);}catch(error){message(error.message,true);}finally{setBusy(false);}});
  on(document,'keydown',event=>{if(!active||busy)return;if(event.key==='Escape'){event.preventDefault();close();entry.focus({preventScroll:true});}if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'&&!event.target.closest('input,textarea,[contenteditable]')){event.preventDefault();$('[data-about-undo]').click();}});
  on(window,'resize',()=>{drag=null;hideGuides();if(active){if(lastProfile!==profile()&&toolbar.contains(document.activeElement))document.activeElement.blur();render();}lastProfile=profile();});
  dispose=()=>{abort.abort();active=false;draft=structuredClone(original);render();entry.hidden=false;toolbar.hidden=true;overlay.hidden=true;parent.append(entry,toolbar);for(const node of page.querySelectorAll('.about-move-frame,.about-position-snap'))node.remove();document.body.classList.remove('is-about-shape-editing');};
}
mount();document.addEventListener('astro:page-load',mount);document.addEventListener('astro:before-swap',()=>dispose?.());if(import.meta.hot)import.meta.hot.dispose(()=>dispose?.());
