export function mountShowreelEditor(){
  const root=document.querySelector('[data-showreel-editor]');if(!root)return ()=>{};
  const dialog=root.querySelector('dialog'),form=root.querySelector('form'),status=root.querySelector('[data-reel-edit-status]'),abort=new AbortController(),{signal}=abort;
  let version,busy=false,watchLayouts;
  const on=(node,event,fn)=>node.addEventListener(event,fn,{signal});
  const setBusy=value=>{busy=value;for(const field of root.querySelectorAll('button,input,textarea'))field.disabled=value;};
  async function request(options,path='/__portfolio-editor/showreels'){const response=await fetch(path,{...options,signal}),data=await response.json();if(!response.ok)throw new Error(data.error||'操作失败');return data;}
  const thumbnail=(year,src)=>{form.elements.namedItem(year+'.thumbnail').value=src;root.querySelector(`[data-reel-thumbnail-preview="${year}"]`).src=src||`/showreel/${year}-poster.webp`;};
  on(root.querySelector('[data-reel-edit-open]'),'click',async()=>{
    dialog.showModal();setBusy(true);status.textContent='读取中…';
    try{const data=await request();version=data.version;const settings=data.settings;watchLayouts=settings.watchLayouts;
      for(const key of ['title','titleEn','hint','hintEn'])form.elements.namedItem(key).value=settings[key];
      for(const card of settings.cards){for(const key of ['label','description','descriptionEn'])form.elements.namedItem(card.year+'.'+key).value=card[key];thumbnail(card.year,card.thumbnail||'');}
      status.textContent='修改后点「保存到项目」。';
    }catch(error){status.textContent=error.message;}finally{setBusy(false);}
  });
  on(root.querySelector('[data-reel-edit-close]'),'click',()=>dialog.close());
  for(const input of root.querySelectorAll('[data-reel-thumbnail-file]'))on(input,'change',async()=>{
    const file=input.files?.[0];if(!file||busy)return;
    if(!/\.(png|jpe?g|webp|gif|avif)$/i.test(file.name)){status.textContent='请选择 PNG、JPG、WebP、GIF 或 AVIF 图片';input.value='';return;}
    if(file.size>200*1024*1024){status.textContent='单张图片最多 200 MB';input.value='';return;}
    setBusy(true);status.textContent='正在导入缩略图…';
    try{const data=await request({method:'POST',headers:{'Content-Type':'application/octet-stream','X-File-Name':encodeURIComponent(file.name)},body:file},'/__portfolio-editor/upload');thumbnail(input.dataset.reelThumbnailFile,data.src);status.textContent='缩略图已导入，点「保存到项目」后生效。';}
    catch(error){status.textContent=error.message;}finally{input.value='';setBusy(false);}
  });
  for(const button of root.querySelectorAll('[data-reel-thumbnail-reset]'))on(button,'click',()=>{thumbnail(button.dataset.reelThumbnailReset,'');status.textContent='已恢复默认缩略图，点「保存到项目」后生效。';});
  on(form,'submit',async event=>{
    event.preventDefault();if(busy)return;setBusy(true);status.textContent='保存中…';
    const fieldValue=key=>form.elements.namedItem(key).value;
    const settings=Object.fromEntries(['title','titleEn','hint','hintEn'].map(key=>[key,fieldValue(key)]));
    if(watchLayouts)settings.watchLayouts=watchLayouts;
    settings.cards=[2026,2024,2022].map(year=>({year,...Object.fromEntries(['label','description','descriptionEn','thumbnail'].map(key=>[key,fieldValue(year+'.'+key)]))}));
    try{await request({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version,settings})});location.reload();}catch(error){status.textContent=error.message;setBusy(false);}
  });
  return ()=>abort.abort();
}
