import {validateHeaderLayout} from './header-layout.js';
export function validateHomeLayout(layout) {
  if(layout===null)return null;
  const number=(value,min,max,label)=>{
    if(!Number.isFinite(value)||value<min||value>max)throw new Error(label+'超出可用范围');
    return Math.round(value*1000)/1000;
  };
  if(!layout||typeof layout!=='object')throw new Error('首页排版格式不正确');
  const referenceWidth=number(layout.referenceWidth,160,4000,'画布宽度');
  const box=(value,label,minHeight=48,minWidth=48)=>{
    if(!value||typeof value!=='object')throw new Error('缺少'+label+'排版');
    return {x:number(value.x,-referenceWidth*2,referenceWidth*2,label+'横坐标'),y:number(value.y,-300,8000,label+'纵坐标'),width:number(value.width,minWidth,referenceWidth*3,label+'宽度'),height:number(value.height,minHeight,5000,label+'高度')};
  };
  const character=box(layout.character,'小人'),wheel=box(layout.wheel,'滚轮');
  wheel.fontSize=number(layout.wheel.fontSize,6,240,'滚轮字号');
  wheel.pointerSize=number(layout.wheel.pointerSize,1,60,'指针大小');
  wheel.pointerOffset=number(layout.wheel.pointerOffset,-300,300,'指针位置');
  let socials;
  if(layout.socials){
    socials=box(layout.socials,'联系图标',16);
    for(const key of ['iconSize','artSize','gap','radius'])socials[key]=number(layout.socials[key],0,400,'联系图标尺寸');
  }
  const modelPicker=layout.modelPicker?box(layout.modelPicker,'模型竖条',72,16):null;
  return {referenceWidth,height:number(layout.height,80,10000,'画布高度'),character,wheel,...(socials?{socials}:{}),...(modelPicker?{modelPicker}:{}),...(layout.header?{header:validateHeaderLayout(layout.header)}:{})};
}

// 自包含函数：随首屏 HTML 同步执行，已保存的排版无需等待模块下载。
export function applyHomeLayout(hero,layout) {
  const character=hero.querySelector('[data-character-stage]'),wheel=hero.querySelector('[data-category-wheel]'),button=hero.querySelector('.button');
  const clear=(element,keys)=>keys.forEach(key=>element.style.removeProperty(key));
  const socials=document.querySelector('[data-home-social-stage]');
  const modelPicker=hero.querySelector('[data-home-model-picker]');
  function restoreSocials(){
    if(!hero.__homeSocialAnchor)return;
    hero.__homeSocialAnchor.before(socials);hero.__homeSocialAnchor.remove();delete hero.__homeSocialAnchor;
    clear(socials,['position','left','top','width','height','transform','max-width','margin','padding','--home-social-size','--home-social-art-size','--home-social-gap','--home-social-radius']);
  }
  if(!layout){
    restoreSocials();
    hero.removeAttribute('data-home-manual');hero.style.removeProperty('height');
    clear(character,['position','left','top','width','height','transform','max-width']);
    clear(wheel,['position','left','top','width','height','transform','max-width','--wheel-scale','--wheel-row-height','--wheel-font-size','--wheel-pointer-size','--wheel-pointer-offset-x']);
    if(modelPicker)clear(modelPicker,['position','left','top','width','height','transform','max-width','--home-model-picker-scale']);
    clear(button,['left','top']);character.__characterPosterSizing?.update();return;
  }
  const scale=hero.clientWidth/layout.referenceWidth;
  hero.setAttribute('data-home-manual','');
  const place=(element,box)=>{
    Object.assign(element.style,{position:'absolute',left:box.x*scale+'px',top:box.y*scale+'px',width:box.width*scale+'px',height:box.height*scale+'px',transform:'none',maxWidth:'none'});
  };
  place(character,layout.character);place(wheel,layout.wheel);
  let pickerBottom=0;
  if(modelPicker){
    const style=getComputedStyle(modelPicker);
    const box=layout.modelPicker||{x:Math.max(0,layout.character.x+layout.character.width*.12-24),y:layout.character.y+layout.character.height*.22,width:parseFloat(style.getPropertyValue('--home-model-picker-width'))||48,height:parseFloat(style.getPropertyValue('--home-model-picker-height'))||160};
    place(modelPicker,box);
    // 横向缩放决定圆点直径；极短、极宽时限制尺寸，避免三个点互相重叠。
    modelPicker.style.setProperty('--home-model-picker-scale',String(scale*Math.min(box.width/48,box.height/72)));
    pickerBottom=(box.y+box.height)*scale;
  }
  let socialBottom=0;
  if(layout.socials&&socials){
    if(!hero.__homeSocialAnchor){const anchor=document.createElement('span');anchor.hidden=true;socials.before(anchor);hero.__homeSocialAnchor=anchor;hero.append(socials);}
    place(socials,layout.socials);socials.style.margin='0';socials.style.padding='0';
    for(const [key,variable] of Object.entries({iconSize:'--home-social-size',artSize:'--home-social-art-size',gap:'--home-social-gap',radius:'--home-social-radius'}))socials.style.setProperty(variable,layout.socials[key]*scale+'px');
    socialBottom=(layout.socials.y+layout.socials.height)*scale+(parseFloat(getComputedStyle(socials).getPropertyValue('--home-social-bottom-space'))||0);
  }else restoreSocials();
  wheel.style.setProperty('--wheel-scale','1');
  wheel.style.setProperty('--wheel-row-height',layout.wheel.height*scale/5+'px');
  wheel.style.setProperty('--wheel-font-size',layout.wheel.fontSize*scale+'px');
  wheel.style.setProperty('--wheel-pointer-size',layout.wheel.pointerSize*scale+'px');
  wheel.style.setProperty('--wheel-pointer-offset-x',layout.wheel.pointerOffset*scale+'px');
  const gap=parseFloat(getComputedStyle(hero).getPropertyValue('--showreel-gap'))||24;
  const buttonTop=(layout.wheel.y+layout.wheel.height)*scale+gap;
  button.style.left=layout.wheel.x*scale+'px';button.style.top=buttonTop+'px';
  hero.style.height=Math.max(layout.height*scale,(layout.character.y+layout.character.height)*scale,buttonTop+button.offsetHeight+20,socialBottom,pickerBottom)+'px';
  character.__characterPosterSizing?.update();
}

export function mountHomeLayout(hero,apply) {
  hero.__homeLayout?.dispose();
  let width=-1,device='';
  const mode=()=>matchMedia('(max-width: 700px)').matches?'mobile':'desktop';
  function refresh(force=false){
    if(innerWidth<160||hero.clientWidth<160)return;
    const nextDevice=mode();
    if(hero.__homeLayoutEditing){
      if(device!==nextDevice)hero.dispatchEvent(new CustomEvent('home:layout-device-change'));
      return;
    }
    if(!force&&width===hero.clientWidth&&device===nextDevice)return;
    device=nextDevice;width=hero.clientWidth;
    let store={};try{store=JSON.parse(hero.dataset.homeLayouts||'{}');}catch{}
    apply(hero,store[device]||null);
  }
  const observer=new ResizeObserver(()=>refresh());observer.observe(hero);refresh(true);
  const controller={refresh:()=>refresh(true),device:mode,setStore(store){hero.dataset.homeLayouts=JSON.stringify(store);refresh(true);},dispose(){observer.disconnect();}};
  hero.__homeLayout=controller;return controller;
}
