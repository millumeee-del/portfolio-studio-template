import {HEADER_ITEMS,headerSelector,headerLayoutCSS,validateHeaderLayout} from '../lib/header-layout.js';
import {homeSnapTargets,moveHomeBox,resizeHomeBox} from '../lib/home-layout-geometry.js';

// Shares the home editor's draft, undo history, version guard and Save button.
export function mountHeaderLayoutEditor(host,{getDraft,getProfile,isBusy,remember,changed}){
 const panel=host.querySelector('[data-header-fields]'),select=panel.querySelector('select'),inputs=[...panel.querySelectorAll('input')];
 const style=document.createElement('style');style.dataset.headerPreview='';document.head.append(style);
 const layer=document.createElement('div');layer.className='header-layout-layer';layer.dataset.noTranslate='';document.body.append(layer);
 const removals=[];let active=false,selected='',drag=null,frame=0;
 const on=(node,type,fn,options)=>{node.addEventListener(type,fn,options);removals.push(()=>node.removeEventListener(type,fn,options));};
 const targets=()=>Object.keys(HEADER_ITEMS).map(key=>[key,document.querySelector(headerSelector(key))]).filter(([,node])=>node);
 const draft=()=>getDraft().header;
 const rect=node=>{const r=node.getBoundingClientRect();return {x:r.left,y:r.top,width:r.width,height:r.height};};
 const anchorFor=(key,x)=>key==='nav'?'center':x<innerWidth/3?'left':'right';
 const anchoredX=(anchor,x,width,referenceWidth)=>anchor==='center'?x+width/2-innerWidth/2:anchor==='left'?x/innerWidth*referenceWidth:innerWidth-x-width;
 function capture(){
  const items={};
  for(const [key,node] of targets()){
   const r=rect(node),css=getComputedStyle(node),matrix=new DOMMatrixReadOnly(css.transform);
   const anchor=anchorFor(key,r.x);items[key]={x:anchoredX(anchor,r.x,r.width,innerWidth),anchor,y:r.y,scale:Math.hypot(matrix.a,matrix.b)||1,fontSize:parseFloat(css.fontSize),gap:parseFloat(css.gap)||0};
  }
  return {referenceWidth:innerWidth,items};
 }
 function preview(){style.textContent=headerLayoutCSS({[getProfile()]:{header:draft()}});}
 function render(){
  if(!active)return;preview();
  for(const box of layer.querySelectorAll('[data-header-box]')){
   const node=document.querySelector(headerSelector(box.dataset.headerBox)),r=rect(node);
   Object.assign(box.style,{left:r.x+'px',top:r.y+'px',width:r.width+'px',height:r.height+'px'});
   box.classList.toggle('is-selected',box.dataset.headerBox===selected);
  }
  select.value=selected;
  const item=draft().items[selected];
  inputs.forEach(input=>{input.disabled=!item||(input.dataset.headerInput==='gap'&&!['nav','moods'].includes(selected));if(item&&document.activeElement!==input)input.value=String(Math.round((input.dataset.headerInput==='x'?rect(document.querySelector(headerSelector(selected))).x:item[input.dataset.headerInput])*100)/100);});
 }
 function guides(values={}){
  layer.querySelectorAll('.home-layout-snap').forEach(node=>node.remove());
  for(const [axis,target] of Object.entries(values)){
   const guide=document.createElement('div');guide.className='home-layout-snap home-layout-snap-'+axis;guide.style[axis==='x'?'left':'top']=target.value+'px';
   const label=document.createElement('span');label.textContent=target.label;guide.append(label);layer.append(guide);
  }
 }
 function open(){
  active=true;getDraft().header=getDraft().header?validateHeaderLayout(getDraft().header):capture();panel.hidden=false;
  select.replaceChildren(new Option('选择顶部组件',''));
  layer.replaceChildren();
  for(const [key] of targets()){
   select.add(new Option(HEADER_ITEMS[key],key));
   const box=document.createElement('div');box.className='home-layout-box';box.dataset.headerBox=key;box.tabIndex=0;box.setAttribute('aria-label',HEADER_ITEMS[key]+'排版框');
   const label=document.createElement('span');label.className='home-layout-box-label';label.textContent=HEADER_ITEMS[key];
   const knob=document.createElement('span');knob.className='home-layout-handle';knob.dataset.handle='se';box.append(label,knob);layer.append(box);
  }
  selected='';render();
 }
 function close(){active=false;drag=null;selected='';panel.hidden=true;layer.replaceChildren();style.textContent='';}
 function commit(){changed();render();}
 on(select,'change',()=>{selected=select.value;render();});
 on(layer,'pointerdown',event=>{
  const box=event.target.closest('[data-header-box]');if(!active||isBusy()||event.button!==0||!box)return;
  event.preventDefault();selected=box.dataset.headerBox;box.focus({preventScroll:true});remember();
  drag={id:event.pointerId,x:event.clientX,y:event.clientY,handle:event.target.dataset.handle,box:rect(document.querySelector(headerSelector(selected))),item:structuredClone(draft().items[selected]),targets:homeSnapTargets(targets().filter(([key])=>key!==selected).map(([key,node])=>({...rect(node),label:HEADER_ITEMS[key]})),innerWidth,innerHeight)};
  box.setPointerCapture(event.pointerId);render();
 });
 on(window,'pointermove',event=>{
  if(!drag||isBusy()||event.pointerId!==drag.id)return;event.preventDefault();
  const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
  const result=drag.handle?resizeHomeBox(drag.box,'se',dx,dy,drag.targets,event.altKey?-1:7,true,8,8):moveHomeBox(drag.box,dx,dy,drag.targets,event.altKey?-1:7);
  const nextScale=drag.item.scale*(result.box.width/drag.box.width);if(nextScale<.25||nextScale>4)return;
  const x=Math.max(0,Math.min(innerWidth-16,result.box.x)),anchor=anchorFor(selected,x);
  Object.assign(draft().items[selected],{anchor,x:anchoredX(anchor,x,result.box.width,draft().referenceWidth),y:Math.max(0,Math.min(4000,result.box.y)),scale:nextScale});
  commit();guides(result.guides);
 },{passive:false});
 const up=event=>{if(drag?.id===event.pointerId){drag=null;guides();}};on(window,'pointerup',up);on(window,'pointercancel',up);
 for(const input of inputs)on(input,'change',()=>{
  const item=draft().items[selected];if(!active||isBusy()||!item)return;
  const key=input.dataset.headerInput,v=Number(input.value),bounds={x:[0,innerWidth*2],y:[0,4000],scale:[.25,4],fontSize:[6,100],gap:[0,200]}[key];
  if(!Number.isFinite(v)||v<bounds[0]||v>bounds[1]){input.value=item[key];return;}
  remember();if(key==='x'){item.anchor=anchorFor(selected,v);item.x=anchoredX(item.anchor,v,rect(document.querySelector(headerSelector(selected))).width,draft().referenceWidth);}else item[key]=v;commit();
 });
 on(panel.querySelector('[data-header-reset]'),'click',()=>{
  if(!active||isBusy())return;
  remember();style.textContent='';
  const saved=document.querySelector('[data-header-saved]'),old=saved?.textContent;if(saved)saved.textContent='';
  getDraft().header=capture();if(saved)saved.textContent=old;commit();
 });
 on(window,'resize',()=>{if(active)render();});
 on(document,'site:language-change',()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(render);});
 return {open,close,render,hasSelection:()=>!!selected,clearSelection(){selected='';render();},dispose(){close();cancelAnimationFrame(frame);style.remove();layer.remove();removals.forEach(remove=>remove());}};
}
