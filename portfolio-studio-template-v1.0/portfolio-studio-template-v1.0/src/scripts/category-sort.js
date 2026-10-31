const sameOrder = (a, b) => a.length === b.length && a.every((slug, i) => slug === b[i]);
export function mountCategorySort() {
  const sidebar = document.querySelector('[data-portfolio-sidebar]');
  const directory = sidebar?.querySelector('[data-category-directory]');
  const toolbar = directory?.querySelector('[data-category-sort-toolbar]');
  if (!toolbar) return () => {};
  const status = toolbar.querySelector('[data-category-sort-status]');
  const save = toolbar.querySelector('[data-category-sort-save]');
  const cancel = toolbar.querySelector('[data-category-sort-cancel]');
  const controller = new AbortController();
  const on = (node, type, handler, options = {}) => node.addEventListener(type, handler, {...options, signal:controller.signal});
  const rows = () => [...directory.querySelectorAll('.sidebar-category')];
  const slug = row => row.querySelector('[data-category-slug]').dataset.categorySlug;
  const order = () => rows().map(slug);
  let active = false, busy = false, loading = false, baseline = [], version, drag, readId = 0;
  let originalRows = [];
  function say(message, error = false) { status.textContent = message; status.classList.toggle('is-error', error); }
  function renumber() { rows().forEach((row, index) => { row.querySelector('.sidebar-number').textContent = String(index + 1).padStart(2, '0'); }); }
  function refresh() {
    const dirty = active && !sameOrder(order(), baseline);
    save.disabled = loading || busy || !dirty;
    cancel.disabled = busy;
    directory.querySelectorAll('[data-category-sort-handle]').forEach(handle => { handle.hidden = !active; handle.disabled = loading || busy; });
  }
  function stopDrag() {
    if (!drag) return;
    drag.row.classList.remove('category-sort-moving'); drag.ghost?.remove(); drag = undefined;
  }
  function close(restore = false) {
    readId++;
    stopDrag();
    if (restore) { originalRows.forEach(row => directory.append(row)); renumber(); }
    active = false; sidebar.classList.remove('is-sorting-categories'); toolbar.hidden = true; refresh();
  }
  async function request(options) {
    const response = await fetch('/__portfolio-editor/categories', options);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '无法保存分区排序');
    return data;
  }
  async function open() {
    if (active) { cancel.focus(); return; }
    const currentRead = ++readId;
    active = true; loading = true; originalRows = rows(); baseline = order();
    toolbar.hidden = false; sidebar.classList.add('is-sorting-categories'); say('正在读取分区…'); refresh();
    try {
      const data = await request();
      if (!active || currentRead !== readId) return;
      if (!sameOrder(data.categories.map(item => item.slug), baseline)) throw new Error('目录已在其他窗口更新，请刷新页面后再排序');
      version = data.version; loading = false;
      say('拖动右侧手柄排序，也可聚焦手柄按 ↑ / ↓。'); refresh();
      directory.querySelector('[data-category-sort-handle]')?.focus();
    } catch (error) { if (active && currentRead === readId) { say(error.message, true); loading = true; refresh(); } }
  }
  on(document, 'portfolio:sort-categories', open);
  on(cancel, 'click', () => close(true));
  on(save, 'click', async () => {
    if (busy || loading) return;
    stopDrag(); busy = true; say('正在保存排序…'); refresh();
    try {
      await request({method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'reorder',order:order(),version})});
      window.location.reload();
    } catch (error) { busy = false; say(error.message, true); refresh(); }
  });
  on(directory, 'keydown', event => {
    if (!active || busy) return;
    if (event.key === 'Escape') { event.preventDefault(); close(true); return; }
    const handle = event.target.closest('[data-category-sort-handle]');
    if (!handle || loading || !['ArrowUp','ArrowDown'].includes(event.key)) return;
    event.preventDefault(); const row = handle.closest('.sidebar-category'), list = rows(), index = list.indexOf(row);
    const next = event.key === 'ArrowUp' ? list[index - 1] : list[index + 1];
    if (!next) return;
    directory.insertBefore(row, event.key === 'ArrowUp' ? next : next.nextSibling);
    renumber(); refresh(); handle.focus(); say(`已移到第 ${rows().indexOf(row) + 1} 位，点击保存排序。`);
  });
  on(directory, 'pointerdown', event => {
    const handle = event.target.closest('[data-category-sort-handle]');
    if (!handle || !active || busy || loading || event.button !== 0) return;
    event.preventDefault(); handle.focus();
    drag = {row:handle.closest('.sidebar-category'),pointer:event.pointerId,startY:event.clientY,startX:event.clientX,before:rows()};
  });
  on(window, 'pointermove', event => {
    if (!drag || event.pointerId !== drag.pointer) return;
    if (!drag.ghost && Math.hypot(event.clientY-drag.startY, event.clientX-drag.startX) < 5) return;
    if (!drag.ghost) {
      drag.row.classList.add('category-sort-moving');
      drag.ghost = document.createElement('div'); drag.ghost.className = 'category-sort-ghost';
      drag.ghost.textContent = drag.row.querySelector('[data-category-slug]').dataset.categoryLabel;
      document.body.append(drag.ghost);
    }
    drag.ghost.style.left = `${event.clientX + 12}px`; drag.ghost.style.top = `${event.clientY + 10}px`;
    const remaining = rows().filter(row => row !== drag.row);
    const before = remaining.find(row => { const box = row.getBoundingClientRect(); return event.clientY < box.top + box.height / 2; });
    directory.insertBefore(drag.row, before || null); renumber(); refresh();
    const bounds = sidebar.getBoundingClientRect();
    if (event.clientY < bounds.top + 40) sidebar.scrollTop -= 10;
    else if (event.clientY > bounds.bottom - 40) sidebar.scrollTop += 10;
  });
  on(window, 'pointerup', event => {
    if (!drag || event.pointerId !== drag.pointer) return;
    const position = rows().indexOf(drag.row) + 1, moved = !!drag.ghost;
    stopDrag(); if (moved) say(`已移到第 ${position} 位，点击保存排序。`);
  });
  function cancelDrag() {
    if (!drag) return;
    drag.before.forEach(row => directory.append(row)); stopDrag(); renumber(); refresh(); say('本次拖动已取消。');
  }
  on(window, 'pointercancel', cancelDrag);
  on(window, 'blur', cancelDrag);
  on(directory, 'click', event => { if (active && event.target.closest('[data-category-slug]')) event.preventDefault(); });
  on(window, 'beforeunload', event => {
    if (active && !busy && !sameOrder(order(), baseline)) { event.preventDefault(); event.returnValue = ''; }
  });
  return () => { close(true); controller.abort(); };
}
