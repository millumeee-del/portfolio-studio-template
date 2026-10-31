import {normalizeTranslationScope} from '../lib/scoped-translations.js';
import {orderedTranslationSources} from '../lib/translation-editor-order.js';
let dispose;
function mount(){
  dispose?.();const dialog=document.querySelector('[data-translation-dialog]');if(!dialog)return;
  const scope=normalizeTranslationScope(location.pathname);
  const abort=new AbortController(),{signal}=abort,$=selector=>document.querySelector(selector),fields=$('[data-translation-fields]'),status=$('[data-translation-editor-status]');
  const on=(node,event,callback)=>node.addEventListener(event,callback,{signal});let rows=[],busy=false;
  const message=(text,error=false)=>{status.textContent=text;status.style.color=error?'#b74a38':'';};
  function setBusy(value){busy=value;for(const node of dialog.querySelectorAll('button,textarea'))node.disabled=value;}
  async function request(path,options){const response=await fetch(path,{...options,signal}),data=await response.json();if(!response.ok)throw new Error(data.error||'译文操作失败');return data;}
  async function load(){
    fields.replaceChildren();const data=await request('/__portfolio-editor/translations?scope='+encodeURIComponent(scope));
    const contentRoot=document.querySelector('.work-article')||document.querySelector('[data-about-page]')||document.querySelector('.portfolio-main')||document.querySelector('[data-home-canvas]');
    const items=[...(contentRoot?.querySelectorAll('[data-translation-source],[data-i18n-zh]')||[])].map(node=>{const rect=node.getBoundingClientRect();return {source:node.dataset.translationSource??node.dataset.i18nZh,top:rect.top,left:rect.left};});
    rows=orderedTranslationSources(items,data.sources).map(source=>({source,en:data.entries[source]?.en||''}));
    for(const row of rows){const label=document.createElement('label');label.className='translation-field';const source=document.createElement('span');source.textContent=row.source;const input=document.createElement('textarea');input.value=row.en;input.rows=Math.min(8,Math.max(2,row.en.split('\n').length));input.dataset.source=row.source;input.setAttribute('aria-label','英文：'+row.source.slice(0,60));input.placeholder='在这里手动填写英文';label.append(source,input);fields.append(label);}
    message(rows.length?'按页面顺序显示 '+rows.length+' 条文字。编辑英文后点「保存译文」。':'当前页面没有可微调的文字。请打开具体作品后使用。');
  }
  on($('[data-translation-open]'),'click',async()=>{dialog.showModal();setBusy(true);message('读取译文…');try{await load();}catch(error){message(error.message,true);}finally{setBusy(false);}});
  on($('[data-translation-close]'),'click',()=>dialog.close());
  // Text selection can start inside and finish over the backdrop. Only a press
  // that also began on the backdrop should dismiss the editor.
  let pressedBackdrop=false;
  const onBackdrop=event=>{const r=dialog.getBoundingClientRect();return event.target===dialog&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom);};
  on(dialog,'pointerdown',event=>{pressedBackdrop=event.isPrimary&&event.button===0&&onBackdrop(event);});
  on(dialog,'pointercancel',()=>{pressedBackdrop=false;});
  on(dialog,'close',()=>{pressedBackdrop=false;});
  on(dialog,'click',event=>{const dismiss=pressedBackdrop&&onBackdrop(event);pressedBackdrop=false;if(dismiss)dialog.close();});
  on($('[data-translation-save]'),'click',async()=>{if(busy)return;const edits=[...fields.querySelectorAll('textarea')].map(input=>({source:input.dataset.source,en:input.value})).filter(item=>item.en!==rows.find(row=>row.source===item.source)?.en);if(!edits.length)return message('没有需要保存的修改。');setBusy(true);try{const data=await request('/__portfolio-editor/translations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scope,entries:edits})});const updates=Object.fromEntries(edits.map(item=>[item.source,data.entries[item.source]?.en||'']));document.dispatchEvent(new CustomEvent('site:translation-update',{detail:{scope,translations:updates}}));for(const item of edits){const row=rows.find(row=>row.source===item.source);if(row)row.en=item.en;}message('已保存英文。');}catch(error){message(error.message,true);}finally{setBusy(false);}});
  dispose=()=>abort.abort();
}
mount();document.addEventListener('astro:page-load',mount);if(import.meta.hot)import.meta.hot.dispose(()=>dispose?.());
