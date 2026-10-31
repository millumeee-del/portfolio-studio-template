export function mountSocialContacts(){
  const removals=[];
  let restoreScroll;
  const on=(element,type,listener)=>{element.addEventListener(type,listener);removals.push(()=>element.removeEventListener(type,listener));};
  for(const button of document.querySelectorAll('[data-wechat-open]')){
    const dialog=document.getElementById(button.getAttribute('aria-controls'));
    if(!dialog)continue;
    const close=()=>dialog.close();
    on(button,'click',()=>{
      if(dialog.open)return;
      const root=document.documentElement,overflow=root.style.overflow,padding=root.style.paddingRight;
      const gutter=window.innerWidth-root.clientWidth;
      root.style.paddingRight=(parseFloat(getComputedStyle(root).paddingRight)+gutter)+'px';root.style.overflow='hidden';
      restoreScroll=()=>{root.style.overflow=overflow;root.style.paddingRight=padding;restoreScroll=undefined;};
      dialog.showModal();
    });
    on(dialog.querySelector('[data-wechat-close]'),'click',close);
    on(dialog,'click',event=>{
      const rect=dialog.getBoundingClientRect();
      if(event.target===dialog&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom))close();
    });
    on(dialog,'close',()=>{restoreScroll?.();button.focus({preventScroll:true});});
    removals.push(()=>{if(dialog.open)dialog.close();});
  }
  return ()=>{removals.forEach(remove=>remove());restoreScroll?.();};
}
