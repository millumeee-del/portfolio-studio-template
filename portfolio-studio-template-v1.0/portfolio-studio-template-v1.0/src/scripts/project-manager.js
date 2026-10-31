import {OVERVIEW_GALLERY,overviewWorkKey,removeGalleryItem} from '../lib/gallery-identity.js';
export function mountProjectManagers() {
  document.querySelectorAll('[data-project-manager]').forEach(host => {
    if (host.dataset.mounted) return;
    host.dataset.mounted = 'true';
    function forgetNavigation() {
      sessionStorage.removeItem('studio-project-navigation');
      document.cookie='studio-navigation=; Path=/; Max-Age=0; SameSite=Strict';
    }
    function rememberNavigation(path) {
      sessionStorage.setItem('studio-project-navigation',JSON.stringify({path,expires:Date.now()+30000}));
      document.cookie=`studio-navigation=${encodeURIComponent(path)}; Path=/; Max-Age=30; SameSite=Strict`;
    }
    try {
      const pending = JSON.parse(sessionStorage.getItem('studio-project-navigation') || 'null');
      if (pending?.path === location.pathname || document.cookie.includes('studio-navigation=')) setTimeout(forgetNavigation, 500);
    } catch {}
    document.addEventListener('click', event => {if (event.target.closest('a[href]')) forgetNavigation();}, true);
    const createDialog = host.querySelector('[data-create-dialog]');
    const createForm = host.querySelector('[data-create-form]');
    const createStatus = host.querySelector('[data-create-status]');
    const deleteDialog = host.querySelector('[data-delete-dialog]');
    const deleteForm = host.querySelector('[data-delete-form]');
    const deleteStatus = host.querySelector('[data-delete-status]');
    const deleteConfirm = host.querySelector('[data-delete-confirm]');
    const categoryDialog = host.querySelector('[data-category-dialog]');
    const categoryForm = host.querySelector('[data-category-form]');
    const categoryStatus = host.querySelector('[data-category-status]');
    const categoryDeleteDialog = host.querySelector('[data-category-delete-dialog]');
    const categoryDeleteForm = host.querySelector('[data-category-delete-form]');
    const categoryDeleteStatus = host.querySelector('[data-category-delete-status]');
    const categoryDeleteConfirm = host.querySelector('[data-category-delete-confirm]');
    const menu = host.querySelector('[data-project-menu]');
    const visibilityDialog = host.querySelector('[data-visibility-dialog]');
    const visibilityStatus = host.querySelector('[data-visibility-status]');
    const hiddenProjects = host.querySelector('[data-hidden-projects]');
    let target = null, deleting = null, busy = false, focusReturn = null;
    let categoryEdit = null, categoryRemoval = null;
    const say = (node, message, error = false) => {node.textContent = message; node.classList.toggle('is-error', error);};
    async function request(url, options) {
      const response = await fetch(url, options), data = await response.json();
      if (!response.ok) throw new Error(data.error || '项目操作失败');
      return data;
    }
    const mutate = payload => request('/__portfolio-editor/projects', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
    const mutateCategory = payload => request('/__portfolio-editor/categories', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
    function hideMenu() { menu.hidden = true; }
    function dialogClose(dialog) { if (!busy) dialog.close(); }
    host.querySelectorAll('[data-dialog-close]').forEach(button => button.addEventListener('click', () => dialogClose(button.closest('dialog'))));
    [createDialog, deleteDialog, categoryDialog, categoryDeleteDialog, visibilityDialog].forEach(dialog => {
      dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
      dialog.addEventListener('close', () => focusReturn?.focus());
    });
    document.querySelectorAll('[data-project-create]').forEach(button => button.addEventListener('click', () => {
      if (busy) return;
      focusReturn = target?.card || button; hideMenu(); createForm.reset();
      if (target?.category || host.dataset.category) createForm.elements.category.value = target?.category || host.dataset.category;
      say(createStatus, ''); createDialog.showModal(); createForm.elements.title.focus();
    }));
    createForm.addEventListener('submit', async event => {
      event.preventDefault(); if (busy) return;
      busy = true; const submit = createForm.querySelector('[type=submit]'); submit.disabled = true; say(createStatus, '正在创建项目…');
      try {
        const data = await mutate({action:'create', title:createForm.elements.title.value, titleEn:createForm.elements.titleEn.value, category:createForm.elements.category.value, studio:createForm.elements.studio.value, year:createForm.elements.year.value});
        const work = data.work;
        const path = `/edit/${encodeURIComponent(work.category)}/${encodeURIComponent(work.slug)}/`;
        rememberNavigation(path);
        window.location.assign(path);
      } catch (error) { say(createStatus, error.message, true); busy = false; submit.disabled = false; }
    });
    function targetFrom(node) {
      if (!(node instanceof Element) || node.closest('input, textarea, select, [contenteditable="true"], video')) return null;
      const category = node.closest('[data-category-slug]');
      if (category) return {type:'category',category:category.dataset.categorySlug,title:category.dataset.categoryLabel,card:category};
      const item = node.closest('[data-work-card], [data-edit-slug], [data-project-category]');
      if (!item) {
        const area=node.closest('[data-portfolio-sidebar], .portfolio-main');
        return area ? {type:'general',category:host.dataset.category || '',card:area} : null;
      }
      const grid = item.closest('[data-works-grid]');
      const card = item.matches('[data-work-card], [data-project-category]') ? item : [...grid.querySelectorAll('[data-work-card]')].find(card => (card.dataset.galleryKey||card.dataset.workSlug) === item.dataset.editSlug);
      if (!card) return null;
      const parts = new URL(card.href).pathname.split('/').filter(Boolean);
      return {type:'work',category:parts[1], slug:card.dataset.workSlug, title:card.dataset.workTitle, hidden:card.dataset.hiddenFromProjects==='true', card};
    }
    function showMenu(item, x, y) {
      if (busy) return;
      target = item; focusReturn = item.card; menu.hidden = false;
      menu.querySelector('[data-project-edit]').hidden = item.type !== 'work';
      menu.querySelector('[data-project-delete]').hidden = item.type !== 'work';
      const visibility = menu.querySelector('[data-project-visibility]');
      visibility.hidden = item.type !== 'work';
      visibility.textContent = item.hidden ? '恢复到 Projects' : '在 Projects 中隐藏';
      menu.querySelector('[data-category-rename]').hidden = item.type !== 'category';
      menu.querySelector('[data-category-delete]').hidden = item.type !== 'category';
      menu.querySelector('[data-category-sort]').hidden = !item.card.closest('[data-portfolio-sidebar]');
      const box = menu.getBoundingClientRect();
      menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - box.width - 8))}px`;
      menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - box.height - 8))}px`;
      menu.querySelector('button').focus();
    }
    document.addEventListener('contextmenu', event => {const item = targetFrom(event.target); if (item) {event.preventDefault(); showMenu(item, event.clientX, event.clientY);} else hideMenu();});
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') { if (!menu.hidden) {hideMenu(); focusReturn?.focus();} }
      else if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
        const item = targetFrom(event.target); if (item) {event.preventDefault(); const box = item.card.getBoundingClientRect(); showMenu(item, box.left + 20, box.top + 20);}
      } else if (!menu.hidden && ['ArrowDown','ArrowUp'].includes(event.key)) {
        event.preventDefault(); const buttons = [...menu.querySelectorAll('button')].filter(button=>!button.hidden); buttons[(buttons.indexOf(document.activeElement)+1)%buttons.length].focus();
      }
    });
    document.addEventListener('pointerdown', event => {if (!menu.contains(event.target)) hideMenu();});
    window.addEventListener('scroll', hideMenu, true); window.addEventListener('resize', hideMenu);
    async function changeVisibility(item, hidden, version) {
      if (busy) return;
      busy = true;
      hiddenProjects.querySelectorAll('button').forEach(button => {button.disabled = true;});
      say(visibilityStatus, hidden ? '正在隐藏项目…' : '正在恢复项目…');
      try {
        if (!version) {
          const data = await request(`/__portfolio-editor/work?category=${encodeURIComponent(item.category)}&slug=${encodeURIComponent(item.slug)}`);
          version = data.version;
        }
        await mutate({action:'visibility',category:item.category,slug:item.slug,hidden,version});
        window.location.reload();
      } catch (error) {
        busy = false;
        hiddenProjects.querySelectorAll('button').forEach(button => {button.disabled = false;});
        say(visibilityStatus,error.message,true);
      }
    }
    menu.querySelector('[data-project-visibility]').addEventListener('click', () => {
      if (busy || target?.type !== 'work') return;
      const item = target; hideMenu(); hiddenProjects.replaceChildren();
      visibilityDialog.showModal();
      changeVisibility(item, !item.hidden);
    });
    menu.querySelector('[data-project-hidden-list]').addEventListener('click', async () => {
      if (busy) return;
      hideMenu(); hiddenProjects.replaceChildren(); visibilityDialog.showModal();
      say(visibilityStatus,'正在读取隐藏项目…');
      try {
        const data = await request('/__portfolio-editor/projects');
        if (!visibilityDialog.open) return;
        say(visibilityStatus,data.hidden.length ? `${data.hidden.length} 个项目未在 Projects 中显示` : '目前没有隐藏项目。');
        for (const item of data.hidden) {
          const row = document.createElement('li'), name = document.createElement('span'), button = document.createElement('button');
          name.textContent = item.title;
          const categoryLabel = [...createForm.elements.category.options].find(option=>option.value===item.category)?.textContent;
          const category = document.createElement('small'); category.textContent = categoryLabel || item.category; name.append(category);
          button.type = 'button'; button.textContent = '恢复显示';
          button.addEventListener('click', () => changeVisibility(item,false,item.version));
          row.append(name,button); hiddenProjects.append(row);
        }
      } catch (error) {say(visibilityStatus,error.message,true);}
    });
    async function editCategory(mode) {
      if (busy) return;
      const selected = target; hideMenu(); categoryEdit = null;
      categoryForm.reset(); host.querySelector('#category-dialog-title').textContent = mode === 'rename' ? '编辑分区名称' : '新增分区';
      categoryForm.querySelector('[type=submit]').disabled = true;
      say(categoryStatus,'正在读取分区…'); categoryDialog.showModal();
      try {
        const data = await request('/__portfolio-editor/categories');
        if (!categoryDialog.open) return;
        const item = mode === 'rename' ? data.categories.find(item=>item.slug===selected.category) : null;
        if (mode === 'rename' && !item) throw new Error('该分区已不存在，请刷新页面');
        categoryEdit = {action:mode,slug:item?.slug,version:data.version};
        categoryForm.elements.label.value = item?.label || '';
        categoryForm.querySelector('[type=submit]').disabled = false;
        say(categoryStatus,''); categoryForm.elements.label.focus();
      } catch(error) {say(categoryStatus,error.message,true);}
    }
    menu.querySelector('[data-category-create]').addEventListener('click',()=>editCategory('create'));
    menu.querySelector('[data-category-sort]').addEventListener('click',()=>{
      hideMenu(); document.dispatchEvent(new CustomEvent('portfolio:sort-categories'));
    });
    menu.querySelector('[data-category-rename]').addEventListener('click',()=>editCategory('rename'));
    categoryForm.addEventListener('submit',async event=>{
      event.preventDefault(); if(busy || !categoryEdit)return;
      busy=true; const submit=categoryForm.querySelector('[type=submit]');submit.disabled=true;say(categoryStatus,'正在保存分区…');
      try {await mutateCategory({...categoryEdit,label:categoryForm.elements.label.value});window.location.reload();}
      catch(error){busy=false;submit.disabled=false;say(categoryStatus,error.message,true);}
    });
    menu.querySelector('[data-category-delete]').addEventListener('click',async()=>{
      if(busy || target?.type!=='category')return;
      const selected=target;hideMenu();categoryRemoval=null;categoryDeleteConfirm.disabled=true;
      host.querySelector('[data-category-delete-name]').textContent=selected.title;
      host.querySelector('[data-category-transfer]').hidden=true;
      say(categoryDeleteStatus,'正在读取分区…');categoryDeleteDialog.showModal();
      try {
        const data=await request('/__portfolio-editor/categories');if(!categoryDeleteDialog.open)return;
        if(!data.categories.some(item=>item.slug===selected.category))throw new Error('该分区已不存在');
        if(data.categories.length<=1)throw new Error('至少需要保留一个分区');
        const count=data.counts[selected.category] || 0;
        categoryRemoval={slug:selected.category,version:data.version};
        const destination=categoryDeleteForm.elements.destination;
        destination.replaceChildren(new Option('请选择接收作品的分区',''),...data.categories.filter(item=>item.slug!==selected.category).map(item=>new Option(item.label,item.slug)));
        destination.required=count>0;
        host.querySelector('[data-category-transfer]').hidden=!count;
        host.querySelector('[data-category-delete-note]').textContent=count ? `此分区有 ${count} 件作品。选择迁入分区后，作品和内容会保留，首页滚轮与目录同步更新。` : '此分区没有作品，删除后首页滚轮与目录同步更新。';
        categoryDeleteConfirm.disabled=false;say(categoryDeleteStatus,'');
      }catch(error){say(categoryDeleteStatus,error.message,true);}
    });
    categoryDeleteForm.addEventListener('submit',async event=>{
      event.preventDefault();if(busy || !categoryRemoval)return;
      busy=true;categoryDeleteConfirm.disabled=true;say(categoryDeleteStatus,'正在删除并更新分区…');
      const destination=categoryDeleteForm.elements.destination.value;
      const path=destination ? `/projects/${encodeURIComponent(destination)}/` : '/projects/';
      try {
        rememberNavigation(path);
        await mutateCategory({action:'delete',...categoryRemoval,destination});window.location.assign(path);
      }catch(error){forgetNavigation();busy=false;categoryDeleteConfirm.disabled=false;say(categoryDeleteStatus,error.message,true);}
    });
    menu.querySelector('[data-project-edit]').addEventListener('click', () => {if (target) window.location.assign(`/edit/${encodeURIComponent(target.category)}/${encodeURIComponent(target.slug)}/`);});
    menu.querySelector('[data-project-delete]').addEventListener('click', async () => {
      if (!target || busy) return;
      const item = target; deleting = null; hideMenu(); deleteConfirm.disabled = true;
      host.querySelector('[data-delete-name]').textContent = item.title;
      say(deleteStatus, '正在读取项目…'); deleteDialog.showModal();
      try {
        const data = await request(`/__portfolio-editor/work?category=${encodeURIComponent(item.category)}&slug=${encodeURIComponent(item.slug)}`);
        if (!deleteDialog.open) return;
        deleting = {...item, version:data.version}; deleteConfirm.disabled = false; say(deleteStatus, '');
      } catch (error) {say(deleteStatus, error.message, true);}
    });
    deleteForm.addEventListener('submit', async event => {
      event.preventDefault(); if (busy || !deleting) return;
      busy = true; deleteConfirm.disabled = true; say(deleteStatus, '正在删除项目…');
      try {
        const data = await mutate({action:'delete', category:deleting.category, slug:deleting.slug, version:deleting.version});
        try {
          localStorage.removeItem(`studio-work-draft:${deleting.category}/${deleting.slug}`);
          for(const [scope,itemKey,previous,next] of [[deleting.category,deleting.slug,data.previousGalleryVersion,data.galleryVersion],[OVERVIEW_GALLERY,overviewWorkKey(deleting),data.previousOverviewGalleryVersion,data.overviewGalleryVersion]]){
            const key=`studio-gallery-draft:${scope}`,cached=JSON.parse(localStorage.getItem(key)||'null');
            if(cached&&cached.version===previous){cached.layout=removeGalleryItem(cached.layout,itemKey);cached.version=next;localStorage.setItem(key,JSON.stringify(cached));}
          }
        } catch {}
        window.location.reload();
      } catch (error) {say(deleteStatus, error.message, true); busy = false; deleteConfirm.disabled = false;}
    });
  });
}
