import {applyHomeLayout} from '../lib/home-layout.js';
import {homeSnapTargets,moveHomeBox,resizeHomeBox} from '../lib/home-layout-geometry.js';
import {mountHeaderLayoutEditor} from './header-layout-editor.js';
import {headerLayoutCSS} from '../lib/header-layout.js';

const clone=value=>structuredClone(value);
const names={character:'小人',wheel:'滚轮',socials:'联系图标',modelPicker:'模型切换按钮'};
const hint='拖动框移动，拖角缩放；顶部组件可设置字号和间距。Alt 暂停吸附；首页组件可用方向键微调，Shift 加速。保存后顶部设置全站通用。';
const proportional=key=>key==='wheel'||key==='socials';
const minHeight=key=>key==='socials'?16:key==='modelPicker'?72:48;
const minWidth=key=>key==='modelPicker'?16:48;
export function mountHomeLayoutEditor(host){
  const hero=document.querySelector('[data-home-canvas]');if(!hero)return ()=>{};
  const wheel=hero.querySelector('[data-category-wheel]'),entry=host.querySelector('[data-home-layout-open]'),toolbar=host.querySelector('[data-home-layout-toolbar]');
  const status=host.querySelector('[data-home-layout-status]'),save=host.querySelector('[data-home-layout-save]'),undo=host.querySelector('[data-home-layout-undo]');
  const mobile=host.querySelector('[data-home-mobile-preview]'),mobileFrame=host.querySelector('[data-home-mobile-frame]'),mobileWidth=host.querySelector('[data-home-mobile-width]');
  const inputs=[...host.querySelectorAll('[data-home-layout-input]')];
  let active=false,busy=false,disposed=false,profile='',version='',store=null,draft=null,selected='character',layer=null,drag=null,resetPending=false;
  const history=[],removals=[];
  const headerEditor=mountHeaderLayoutEditor(host,{getDraft:()=>draft,getProfile:()=>profile,isBusy:()=>busy,remember,changed(){resetPending=false;}});
  const device=()=>matchMedia('(max-width:700px)').matches?'mobile':'desktop';
  const on=(node,type,fn,options)=>{node.addEventListener(type,fn,options);removals.push(()=>node.removeEventListener(type,fn,options));};
  const message=(value,error=false)=>{status.textContent=value;status.classList.toggle('is-error',error);};
  const pause=active=>wheel.dispatchEvent(new CustomEvent('home:layout-edit',{detail:{active}}));
  async function request(options){
    const response=await fetch('/__portfolio-editor/home-layout'+(options?'':'?profile='+device()),options?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(options)}:{cache:'no-store'});
    const data=await response.json();if(!response.ok)throw new Error(data.error||data.message||'排版读取失败');return data;
  }
  function capture(){
    const canvas=hero.getBoundingClientRect();
    const rect=element=>{const r=element.getBoundingClientRect();return {x:r.left-canvas.left,y:r.top-canvas.top,width:r.width,height:r.height};};
    const character=rect(hero.querySelector('[data-character-stage]')),box=rect(wheel);
    const viewport=wheel.querySelector('[data-wheel-viewport]');
    const ratio=box.height/viewport.offsetHeight||1,style=getComputedStyle(wheel);
    Object.assign(box,{fontSize:parseFloat(getComputedStyle(wheel.querySelector('.is-selected [data-wheel-label]')).fontSize)*ratio,pointerSize:(parseFloat(style.getPropertyValue('--wheel-pointer-size'))||5)*ratio,pointerOffset:(parseFloat(style.getPropertyValue('--wheel-pointer-offset-x'))||-30)*ratio});
    const footer=document.querySelector('[data-home-social-stage]'),icons=[...footer.querySelectorAll('.social-icon')].map(element=>element.getBoundingClientRect());
    const left=Math.min(...icons.map(rect=>rect.left)),right=Math.max(...icons.map(rect=>rect.right)),top=Math.min(...icons.map(rect=>rect.top)),bottom=Math.max(...icons.map(rect=>rect.bottom));
    const socials={x:left-canvas.left,y:top-canvas.top,width:right-left,height:bottom-top};
    const socialStyle=getComputedStyle(footer);
    for(const [key,variable] of Object.entries({iconSize:'--home-social-size',artSize:'--home-social-art-size',gap:'--home-social-gap',radius:'--home-social-radius'}))socials[key]=parseFloat(socialStyle.getPropertyValue(variable))||0;
    const modelPicker=rect(hero.querySelector('[data-home-model-picker]'));
    return {referenceWidth:hero.clientWidth,height:Math.max(hero.clientHeight,socials.y+socials.height+(parseFloat(socialStyle.getPropertyValue('--home-social-bottom-space'))||0)),character,wheel:box,socials,modelPicker};
  }
  function remember(){history.push({draft:clone(draft),resetPending});if(history.length>30)history.shift();undo.disabled=false;}
  function guides(values={}){
    layer?.querySelectorAll('.home-layout-snap').forEach(node=>node.remove());
    const scale=hero.clientWidth/draft.referenceWidth;
    for(const [axis,target] of Object.entries(values)){
      const guide=document.createElement('div');guide.className='home-layout-snap home-layout-snap-'+axis;
      guide.style[axis==='x'?'left':'top']=target.value*scale+'px';
      const label=document.createElement('span');label.textContent=target.label;guide.append(label);layer.append(guide);
    }
  }
  function render(){
    if(!active)return;
    applyHomeLayout(hero,draft);
    headerEditor.render();
    const scale=hero.clientWidth/draft.referenceWidth;
    for(const box of layer.querySelectorAll('[data-home-box]')){
      const key=box.dataset.homeBox,rect=draft[key];
      Object.assign(box.style,{left:rect.x*scale+'px',top:rect.y*scale+'px',width:rect.width*scale+'px',height:rect.height*scale+'px'});
      box.classList.toggle('is-selected',key===selected);
      box.querySelector('.home-layout-box-label').textContent=names[key]+' · '+Math.round(rect.width)+' × '+Math.round(rect.height);
    }
    host.querySelector('[data-home-layout-selected]').textContent=names[selected];
    inputs.forEach(input=>{if(input.dataset.homeLayoutInput==='height')input.min=String(minHeight(selected));if(input.dataset.homeLayoutInput==='width')input.min=String(minWidth(selected));if(document.activeElement!==input)input.value=String(Math.round(draft[selected][input.dataset.homeLayoutInput]));});
    undo.disabled=!history.length;
  }
  function createLayer(){
    layer=document.createElement('div');layer.className='home-layout-layer';layer.setAttribute('aria-label','拖动首页组件');
    for(const key of Object.keys(names)){
      const box=document.createElement('div');box.className='home-layout-box';box.dataset.homeBox=key;box.tabIndex=0;box.setAttribute('aria-label',names[key]+'排版框，可拖动或使用方向键');
      const label=document.createElement('span');label.className='home-layout-box-label';box.append(label);
      for(const handle of ['nw','n','ne','e','se','s','sw','w']){
        const knob=document.createElement('span');knob.className='home-layout-handle';knob.dataset.handle=handle;box.append(knob);
      }
      layer.append(box);
    }
    hero.append(layer);
  }
  async function open(){
    if(active||busy)return;busy=true;entry.disabled=true;
    try{
      const data=await request();if(disposed)return;
      profile=data.profile;version=data.version;store=data.layouts;
      hero.__homeLayout?.setStore(store);
      pause(true);
      const captured=capture();
      if(data.layout){
        draft=clone(data.layout);
        // 旧排版没有竖条字段；将当前屏幕位置换回保存时的画布坐标。
        const scale=draft.referenceWidth/captured.referenceWidth;
        for(const key of ['socials','modelPicker'])if(!draft[key]){
          draft[key]=Object.fromEntries(Object.entries(captured[key]).map(([name,value])=>[name,value*scale]));
        }
      }else draft=captured;
      history.length=0;resetPending=false;
      active=true;hero.__homeLayoutEditing=true;document.body.classList.add('is-home-layout-editing');
      entry.hidden=true;toolbar.hidden=false;host.querySelector('[data-home-layout-device]').textContent=profile==='mobile'?'手机首页排版':'电脑首页排版';
      createLayer();headerEditor.open();render();message(hint);
    }catch(error){toolbar.hidden=false;message(error.message,true);}
    finally{busy=false;entry.disabled=false;}
  }
  function close(){
    if(busy)return;
    active=false;drag=null;hero.__homeLayoutEditing=false;layer?.remove();layer=null;history.length=0;
    headerEditor.close();
    document.body.classList.remove('is-home-layout-editing');toolbar.hidden=true;entry.hidden=false;
    if(store)hero.__homeLayout?.setStore(store);else hero.__homeLayout?.refresh();pause(false);
  }
  function updateWheel(box,before){
    const ratio=box.width/before.width;
    box.fontSize=before.fontSize*ratio;box.pointerSize=before.pointerSize*ratio;box.pointerOffset=before.pointerOffset*ratio;
  }
  function updateSocials(box,before){const ratio=box.width/before.width;for(const key of ['iconSize','artSize','gap','radius'])box[key]=before[key]*ratio;}
  function down(event){
    if(!active||busy||event.button!==0)return;
    const box=event.target.closest?.('[data-home-box]');if(!box||!layer.contains(box))return;
    event.preventDefault();headerEditor.clearSelection();selected=box.dataset.homeBox;box.focus({preventScroll:true});remember();resetPending=false;
    const scale=hero.clientWidth/draft.referenceWidth;
    drag={id:event.pointerId,startX:event.clientX,startY:event.clientY,scale,box:clone(draft[selected]),handle:event.target.dataset.handle||'',targets:homeSnapTargets(Object.keys(names).filter(key=>key!==selected).map(key=>({...draft[key],label:names[key]})),draft.referenceWidth,hero.clientHeight/scale)};
    box.setPointerCapture(event.pointerId);render();
  }
  function move(event){
    if(!drag||event.pointerId!==drag.id)return;
    event.preventDefault();
    const dx=(event.clientX-drag.startX)/drag.scale,dy=(event.clientY-drag.startY)/drag.scale,threshold=event.altKey?-1:7/drag.scale;
    const result=drag.handle?resizeHomeBox(drag.box,drag.handle,dx,dy,drag.targets,threshold,proportional(selected),minHeight(selected),minWidth(selected)):moveHomeBox(drag.box,dx,dy,drag.targets,threshold);
    // Keep drafts inside the same generous limits accepted by the save endpoint.
    result.box.x=Math.max(-draft.referenceWidth*2,Math.min(draft.referenceWidth*2,result.box.x));
    result.box.y=Math.max(-300,Math.min(8000,result.box.y));
    if(result.box.width>draft.referenceWidth*3||result.box.height>5000||result.box.fontSize>240)return;
    if(selected==='wheel'&&drag.handle)updateWheel(result.box,drag.box);
    if(selected==='socials'&&drag.handle)updateSocials(result.box,drag.box);
    if(selected==='socials'&&['iconSize','artSize','gap','radius'].some(key=>result.box[key]>400))return;
    if(selected==='wheel'&&(result.box.fontSize<6||result.box.fontSize>240||result.box.pointerSize>60||Math.abs(result.box.pointerOffset)>300))return;
    draft[selected]=result.box;render();guides(result.guides);
  }
  function up(event){if(drag&&event.pointerId===drag.id){drag=null;guides();}}
  on(entry,'click',open);on(host.querySelector('[data-home-layout-cancel]'),'click',close);
  on(hero,'pointerdown',down);on(window,'pointermove',move,{passive:false});on(window,'pointerup',up);on(window,'pointercancel',up);
  on(save,'click',async()=>{
    if(!active||busy)return;busy=true;save.disabled=true;message('正在保存…');
    try{
      const data=await request({profile,version,layout:resetPending?null:draft});
      version=data.version;store=data.layouts;hero.dataset.homeLayouts=JSON.stringify(store);
      document.querySelector('[data-header-saved]').textContent=headerLayoutCSS(store);
      message('已保存'+(profile==='mobile'?'手机':'电脑')+'排版。重新打开首页也会保留，发布时会一并带上。');
    }catch(error){message(error.message,true);}finally{busy=false;save.disabled=false;}
  });
  on(undo,'click',()=>{if(!active||!history.length||busy)return;const previous=history.pop();draft=previous.draft;resetPending=previous.resetPending;render();guides();message('已撤销。'+hint);});
  on(host.querySelector('[data-home-layout-reset]'),'click',()=>{
    if(!active||busy)return;remember();const header=draft.header;applyHomeLayout(hero,null);draft={...capture(),header};resetPending=false;render();guides();message('已预览首页默认排版，顶部设置保留；点击保存后生效。可撤销。');
  });
  inputs.forEach(input=>on(input,'change',()=>{
    if(!active||busy)return;const key=input.dataset.homeLayoutInput,value=Number(input.value),before=clone(draft[selected]);
    const minimum=key==='height'?minHeight(selected):key==='width'?minWidth(selected):key==='y'?-300:-draft.referenceWidth*2;
    const maximum=key==='width'?draft.referenceWidth*3:key==='height'?5000:key==='y'?8000:draft.referenceWidth*2;
    if(!Number.isFinite(value)||value<minimum||value>maximum){input.value=Math.round(before[key]);message('数值超出可调整范围。',true);return;}
    const next={...before,[key]:value};
    if(proportional(selected)&&(key==='width'||key==='height')){
      const factor=value/before[key];next.width=before.width*factor;next.height=before.height*factor;
      if(selected==='wheel')updateWheel(next,before);else updateSocials(next,before);
      if(next.fontSize<6||next.fontSize>240||next.width<48||next.height<(selected==='socials'?16:48)||next.pointerSize>60||Math.abs(next.pointerOffset)>300||next.width>draft.referenceWidth*3||next.height>5000||(selected==='socials'&&['iconSize','artSize','gap','radius'].some(metric=>next[metric]>400))){input.value=Math.round(before[key]);return;}
    }
    remember();resetPending=false;draft[selected]=next;render();guides();message(hint);
  }));
  on(window,'keydown',event=>{
    if(!active||busy||headerEditor.hasSelection()||event.target.closest?.('input,textarea,select,[contenteditable="true"]'))return;
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault();event.stopImmediatePropagation();remember();resetPending=false;
    const step=event.shiftKey?10:1;
    const box=draft[selected];box.x=Math.max(-draft.referenceWidth*2,Math.min(draft.referenceWidth*2,box.x+(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0)));
    box.y=Math.max(-300,Math.min(8000,box.y+(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0)));render();guides();
  },true);
  function hideMobile(){mobile.hidden=true;mobileFrame.replaceChildren();}
  on(host.querySelector('[data-home-layout-mobile]'),'click',()=>{
    mobileFrame.replaceChildren();const iframe=document.createElement('iframe');iframe.title='手机首页排版';iframe.src='/?home-layout-editor=mobile';iframe.style.width=mobileWidth.value+'px';mobileFrame.append(iframe);mobile.hidden=false;
  });
  on(host.querySelector('[data-home-mobile-close]'),'click',hideMobile);
  on(mobileWidth,'change',()=>{const iframe=mobileFrame.querySelector('iframe');if(iframe)iframe.style.width=mobileWidth.value+'px';});
  if(window.self!==window.top)host.querySelector('[data-home-layout-mobile]').hidden=true;
  on(hero,'home:layout-device-change',()=>{if(active&&!busy){close();message('视口已切换，请重新打开相应排版。');}});
  let lastWidth=hero.clientWidth;
  const observer=new ResizeObserver(()=>{if(active&&hero.clientWidth>=160&&hero.clientWidth!==lastWidth){lastWidth=hero.clientWidth;render();}});observer.observe(hero);
  if(new URLSearchParams(location.search).get('home-layout-editor')==='mobile')open();
  return ()=>{disposed=true;busy=false;close();headerEditor.dispose();hideMobile();observer.disconnect();removals.forEach(remove=>remove());};
}
