import {resizeGalleryRow,insertGalleryIntoRow,moveGalleryToNextRow} from '../lib/gallery-layout.js';
const clone = value => value == null ? null : JSON.parse(JSON.stringify(value));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const cardKey=card=>card.dataset.galleryKey||card.dataset.workSlug;

export function mountGalleryEditors() {
  document.querySelectorAll('[data-gallery-editor]').forEach(host => {
    if (host.dataset.mounted) return;
    const grid = [...document.querySelectorAll('[data-works-grid]')].find(node => node.dataset.galleryCategory === host.dataset.category);
    if (!grid) return;
    host.dataset.mounted = 'true';
    const cards = [...grid.querySelectorAll('[data-work-card]')];
    const category = host.dataset.category;
    const key = `studio-gallery-draft:${category}`;
    const open = host.querySelector('[data-layout-open]');
    const panel = host.querySelector('[data-layout-panel]');
    const status = host.querySelector('[data-layout-status]');
    const save = host.querySelector('[data-layout-save]');
    const undo = host.querySelector('[data-layout-undo]');
    const preview = host.querySelector('[data-layout-preview]');
    const widthInput = host.querySelector('[data-layout-width]');
    const heightInput = host.querySelector('[data-layout-height]');
    const selectedLabel = host.querySelector('[data-layout-selected]');
    const nextRowButton=host.querySelector('[data-layout-next-row]');
    const previousRowButton=host.querySelector('[data-layout-previous-row]');
    const wrapOptions=()=>{const ratio=parseFloat(getComputedStyle(grid).getPropertyValue('--gallery-wrap-min-ratio'));return {minRatio:Number.isFinite(ratio)?Math.max(0,ratio):.5};};
    const layer = document.createElement('div'); layer.className = 'gallery-editor-layer'; layer.hidden = true; grid.append(layer);
    let active = false, previewing = false, saving = false, loading = false, selected = null;
    let draft = null, saved = null, version = null, history = [], drag = null, ghost = null, dropIndicator = null;
    const frames = new Map();
    const say = (message, error = false) => { status.textContent = message; status.classList.toggle('is-error', error); };
    const dirty = () => !same(draft, saved);
    function cache() { try { localStorage.setItem(key, JSON.stringify({version, layout: draft})); } catch {} }
    function clearCache() { try { localStorage.removeItem(key); } catch {} }
    function apply(layout) {
      grid.dataset.galleryLayout = JSON.stringify(layout);
      grid.dispatchEvent(new Event('gallery:change'));
    }
    function pushHistory(value=draft) { history.push(clone(value)); if (history.length > 30) history.shift(); undo.disabled = false; }
    function snapshot() {
      const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
      const ordered=cards.map(card=>({slug:cardKey(card),box:card.getBoundingClientRect()})).sort((a,b)=>Math.abs(a.box.top-b.box.top)>1?a.box.top-b.box.top:a.box.left-b.box.left);
      const rows=[];let lastTop=null;
      for(const item of ordered){if(lastTop===null||Math.abs(item.box.top-lastTop)>1){rows.push({slugs:[],span:0});lastTop=item.box.top;}const row=rows.at(-1);row.slugs.push(item.slug);row.span=Math.min(1,row.span+(item.box.width+gap)/(grid.clientWidth+gap));}
      return {cards:Object.fromEntries(ordered.map(({slug,box})=>[slug,{span:(box.width+gap)/(grid.clientWidth+gap),height:box.height}])),rows};
    }
    function select(slug) {
      selected = slug;
      frames.forEach((frame, key) => frame.classList.toggle('is-selected', key === slug));
      const card = cards.find(card => cardKey(card) === slug);
      if (!card) return;
      selectedLabel.textContent = card.dataset.workTitle;
      widthInput.disabled = heightInput.disabled = false;
      updateInputs(card);
      nextRowButton.disabled=false;
      previousRowButton.disabled=false;
    }
    function updateInputs(card) {
      const box = card.getBoundingClientRect();
      if (document.activeElement !== widthInput) widthInput.value = Math.round(box.width);
      if (document.activeElement !== heightInput) heightInput.value = Math.round(box.height);
      widthInput.max = grid.clientWidth;
    }
    function syncFrames() {
      if (!active) return;
      const bounds = grid.getBoundingClientRect();
      cards.forEach(card => {
        const box = card.getBoundingClientRect(), frame = frames.get(cardKey(card));
        Object.assign(frame.style, {width: `${box.width}px`, height: `${box.height}px`, transform: `translate3d(${box.left - bounds.left}px, ${box.top - bounds.top}px, 0)`});
        frame.querySelector('.gallery-edit-size').textContent = `${Math.round(box.width)} × ${Math.round(box.height)} px`;
        if (selected === cardKey(card)) updateInputs(card);
      });
      if(dropIndicator&&drag?.kind==='order'){
        const box=cards.find(card=>cardKey(card)===drag.slug).getBoundingClientRect();
        Object.assign(dropIndicator.style,{height:`${box.height}px`,transform:`translate3d(${Math.max(0,box.left-bounds.left-6)}px, ${box.top-bounds.top}px, 0)`});
      }
    }
    function changeSize(slug, width, height, baseline) {
      const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
      const before=baseline||snapshot();draft=resizeGalleryRow(before,slug,width,height,grid.clientWidth,gap,wrapOptions());
      const wrapped=JSON.stringify(draft.rows.map(row=>row.slugs))!==JSON.stringify(before.rows.map(row=>row.slugs));
      if(wrapped&&drag?.kind==='resize')drag.baseline=clone(draft);
      apply(draft); cache(); say(wrapped?'过窄卡片已移到下一行 · 可撤销，保存后应用':'未保存的排版 · 已保留本地草稿');
    }
    function currentSize(card) {
      return card.getBoundingClientRect();
    }
    function setPreview(value) {
      previewing = value; layer.hidden = value;
      grid.classList.toggle('is-layout-editing', !value);
      preview.textContent = value ? '继续调整' : '预览';
    }
    function close() {
      active = false; panel.hidden = true; open.hidden = false; layer.hidden = true;
      grid.classList.remove('is-layout-editing'); history = []; undo.disabled = true;
    }
    async function request(options) {
      const response = await fetch(`/__portfolio-editor/gallery?category=${encodeURIComponent(category)}`, options);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '排版操作失败');
      return data;
    }
    open.addEventListener('click', async () => {
      if (loading) return;
      loading = true; open.disabled = true; save.disabled = true;
      panel.hidden = false; say('正在读取排版…');
      try {
        const data = await request(); saved = clone(data.layout); draft = clone(saved); version = data.version;
        let restored = false;
        try {
          const cached = JSON.parse(localStorage.getItem(key) || 'null');
          if (cached && cached.version === version && !same(cached.layout, saved)) { draft = cached.layout; restored = true; }
          else if (cached && same(cached.layout, saved)) clearCache();
        } catch {}
        active = true; open.hidden = true; history = []; undo.disabled = true; save.disabled = false;
        apply(draft); setPreview(false);
        syncFrames(); if (cards.length) select(cardKey(cards[0]));
        say(restored ? '已恢复未保存的本地草稿。保存后应用到当前画廊。' : '拖入目标行的间隙或右侧空白处插入；拖边缘调尺寸。末张可自由缩窄，其他卡片过窄时换行。');
      } catch (error) { say(error.message, true); }
      finally { loading = false; open.disabled = false; }
    });
    cards.forEach(card => {
      const slug = cardKey(card);
      const frame = document.createElement('div'); frame.className = 'gallery-edit-frame'; frame.dataset.editSlug = slug;
      frame.tabIndex=0;frame.setAttribute('role','group');frame.setAttribute('aria-label',`拖动 ${card.dataset.workTitle} 调整顺序，或按 Alt 加左右方向键`);
      const label = document.createElement('span'); label.className = 'gallery-edit-label'; label.textContent = card.dataset.workTitle;
      const size = document.createElement('span'); size.className = 'gallery-edit-size';
      frame.append(label, size); frame.addEventListener('click', () => select(slug));
      frame.addEventListener('pointerdown',event=>{
        if(saving||previewing||event.button!==0||event.target.closest('[data-resize]'))return;
        event.preventDefault();select(slug);frame.focus({preventScroll:true});
        const bounds=grid.getBoundingClientRect(),box=card.getBoundingClientRect(),baseline=snapshot();
        drag={kind:'order',slug,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,before:clone(draft),baseline,target:null,moved:false,offsetX:event.clientX-box.left,offsetY:event.clientY-box.top,box,
          rows:baseline.rows.map((row,index)=>{const items=row.slugs.map(item=>{const rect=cards.find(c=>cardKey(c)===item).getBoundingClientRect();return {slug:item,x:rect.left-bounds.left,y:rect.top-bounds.top,width:rect.width,height:rect.height};});return {index,top:Math.min(...items.map(item=>item.y)),bottom:Math.max(...items.map(item=>item.y+item.height)),items};})};
        frame.setPointerCapture(event.pointerId);
      });
      frame.addEventListener('pointermove',event=>{
        if(drag?.kind!=='order'||drag.pointerId!==event.pointerId)return;
        const g=drag;if(!g.moved&&Math.hypot(event.clientX-g.startX,event.clientY-g.startY)<5)return;
        if(!g.moved){g.moved=true;ghost=card.cloneNode(true);ghost.removeAttribute('href');ghost.removeAttribute('data-work-card');ghost.classList.add('gallery-drag-ghost');ghost.setAttribute('aria-hidden','true');Object.assign(ghost.style,{width:g.box.width+'px',height:g.box.height+'px',transform:'none'});document.body.append(ghost);grid.classList.add('is-gallery-reordering');frame.classList.add('is-dragging');card.classList.add('is-gallery-drag-source');dropIndicator=document.createElement('div');dropIndicator.className='gallery-drop-indicator';dropIndicator.setAttribute('aria-hidden','true');const caption=document.createElement('span');caption.textContent='插入此行';dropIndicator.append(caption);layer.append(dropIndicator);}
        Object.assign(ghost.style,{left:event.clientX-g.offsetX+'px',top:event.clientY-g.offsetY+'px'});
        const bounds=grid.getBoundingClientRect(),x=event.clientX-bounds.left,y=event.clientY-bounds.top;
        const target=g.rows.reduce((best,row)=>{const distance=Math.max(row.top-y,0,y-row.bottom);return !best||distance<best.distance?{...row,distance}:best;},null);
        const before=target.items.filter(item=>item.slug!==slug).find(item=>x<item.x+item.width/2)?.slug||null,signature=JSON.stringify([target.index,before]);
        if(signature!==g.target){g.target=signature;const candidate=insertGalleryIntoRow(g.baseline,slug,target.index,before,grid.clientWidth,parseFloat(getComputedStyle(grid).columnGap)||0,wrapOptions());draft=same(candidate,g.baseline)?clone(g.before):candidate;apply(draft);cache();say('插入目标行 · 松开确认，行内宽度会自动分配');}
        if(event.clientY>innerHeight-45)window.scrollBy(0,12);else if(event.clientY<70)window.scrollBy(0,-12);
      });
      const finishOrder=event=>{
        if(drag?.kind!=='order'||drag.pointerId!==event.pointerId)return;
        const g=drag;drag=null;ghost?.remove();ghost=null;dropIndicator?.remove();dropIndicator=null;grid.classList.remove('is-gallery-reordering');frame.classList.remove('is-dragging');card.classList.remove('is-gallery-drag-source');
        if(event.type==='pointercancel'){draft=g.before;apply(draft);cache();say('已取消本次拖动');}
        else if(g.moved&&!same(g.before,draft)){pushHistory(g.before);cache();say('已调整顺序 · 尚未保存');}
      };
      frame.addEventListener('pointerup',finishOrder);frame.addEventListener('pointercancel',finishOrder);frame.addEventListener('lostpointercapture',finishOrder);
      frame.addEventListener('keydown',event=>{
        if(saving||event.target!==frame||!event.altKey||!['ArrowLeft','ArrowRight'].includes(event.key))return;
        event.preventDefault();select(slug);const baseline=snapshot(),rowIndex=baseline.rows.findIndex(row=>row.slugs.includes(slug)),row=baseline.rows[rowIndex],index=row.slugs.indexOf(slug),right=event.key==='ArrowRight';let target=rowIndex,before;
        if(right&&index===row.slugs.length-1){if(!baseline.rows[rowIndex+1])return;target++;before=baseline.rows[target].slugs[0];}
        else if(!right&&index===0){if(!rowIndex)return;target--;before=null;}
        else before=right?row.slugs[index+2]||null:row.slugs[index-1];
        pushHistory();draft=insertGalleryIntoRow(baseline,slug,target,before,grid.clientWidth,parseFloat(getComputedStyle(grid).columnGap)||0,wrapOptions());apply(draft);cache();say('已调整顺序与行位置 · 尚未保存');
      });
      ['width', 'height', 'both'].forEach(direction => {
        const handle = document.createElement('button'); handle.type = 'button'; handle.className = 'gallery-resize-handle'; handle.dataset.resize = direction;
        const action = direction === 'width' ? '宽度' : direction === 'height' ? '高度' : '宽度和高度';
        handle.setAttribute('aria-label', `调整 ${card.dataset.workTitle} 的${action}`); handle.title = `拖动调整${action}，或使用方向键`;
        handle.addEventListener('pointerdown', event => {
          if (saving || event.button !== 0) return;
          event.preventDefault(); event.stopPropagation(); select(slug);
          const box = card.getBoundingClientRect();
          drag = {kind:'resize',slug, direction, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, width: box.width, height: box.height,before:clone(draft),baseline:snapshot()};
          handle.setPointerCapture(event.pointerId);
        });
        handle.addEventListener('pointermove', event => {
          if (drag?.kind!=='resize' || drag.pointerId !== event.pointerId) return;
          changeSize(slug, drag.width + (direction !== 'height' ? event.clientX - drag.startX : 0), drag.height + (direction !== 'width' ? event.clientY - drag.startY : 0),drag.baseline);
        });
        const endDrag = event => { if (drag?.kind!=='resize'||drag.pointerId!==event.pointerId)return;const g=drag;drag=null;if(event.type==='pointercancel'){draft=g.before;apply(draft);cache();}else if(!same(g.before,draft))pushHistory(g.before); };
        handle.addEventListener('pointerup', endDrag); handle.addEventListener('lostpointercapture', endDrag); handle.addEventListener('pointercancel', endDrag);
        handle.addEventListener('keydown', event => {
          if (saving || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
          event.preventDefault(); select(slug); pushHistory();
          const box = currentSize(card), step = event.shiftKey ? 40 : 8;
          changeSize(slug, box.width + (direction !== 'height' ? event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0 : 0), box.height + (direction !== 'width' ? event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0 : 0));
        });
        frame.append(handle);
      });
      frames.set(slug, frame); layer.append(frame);
    });
    grid.addEventListener('gallery:render', syncFrames);
    grid.addEventListener('click', event => { if (active && !previewing) { event.preventDefault(); if (event.target.closest('[data-work-card]')) event.stopImmediatePropagation(); } }, true);
    [widthInput, heightInput].forEach(input => input.addEventListener('change', () => {
      if (!selected || saving) return;
      const card = cards.find(card => cardKey(card) === selected), box = currentSize(card);
      if (!Number.isFinite(input.valueAsNumber)) { updateInputs(card); return; }
      pushHistory(); changeSize(selected, input === widthInput ? input.valueAsNumber : box.width, input === heightInput ? input.valueAsNumber : box.height);
    }));
    undo.addEventListener('click', () => { if (!history.length || saving) return; draft = history.pop(); undo.disabled = !history.length; apply(draft); cache(); say('已撤销上一次调整'); });
    nextRowButton.addEventListener('click',()=>{
      if(!selected||saving)return;const baseline=snapshot(),gap=parseFloat(getComputedStyle(grid).columnGap)||0;
      if(baseline.rows.find(row=>row.slugs.includes(selected))?.slugs.length<2){say('这张卡片已单独成行');return;}
      pushHistory();draft=moveGalleryToNextRow(baseline,selected,grid.clientWidth,gap,wrapOptions());apply(draft);cache();say('已移到下一行 · 尚未保存');
    });
    previousRowButton.addEventListener('click',()=>{
      if(!selected||saving)return;const baseline=snapshot(),index=baseline.rows.findIndex(row=>row.slugs.includes(selected));
      if(index<1){say('这张卡片已经在第一行');return;}
      pushHistory();draft=insertGalleryIntoRow(baseline,selected,index-1,null,grid.clientWidth,parseFloat(getComputedStyle(grid).columnGap)||0,wrapOptions());apply(draft);cache();say('已插入上一行 · 尚未保存');
    });
    preview.addEventListener('click', () => setPreview(!previewing));
    host.querySelector('[data-layout-auto]').addEventListener('click', () => { if (saving) return; pushHistory(); draft = null; apply(null); cache(); say('已恢复自动排版，点击“保存并退出”确认应用。'); });
    host.querySelector('[data-layout-cancel]').addEventListener('click', () => { if (saving) return; draft = clone(saved); clearCache(); apply(saved); close(); });
    save.addEventListener('click', async () => {
      if (saving) return;
      saving = true; host.querySelectorAll('button, input').forEach(control => control.disabled = true); say('正在保存排版…');
      try {
        const data = await request({method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({category, version, layout: draft})});
        saved = clone(data.layout); draft = clone(saved); version = data.version; clearCache(); apply(saved); close();
      } catch (error) { say(error.message, true); }
      finally { saving = false; host.querySelectorAll('button, input').forEach(control => control.disabled = false); undo.disabled = !history.length; }
    });
    window.addEventListener('beforeunload', event => { if (active && dirty() && !saving) { event.preventDefault(); event.returnValue = ''; } });
    window.addEventListener('resize', () => { if (active && window.innerWidth <= 700) setPreview(true); });
  });
}
