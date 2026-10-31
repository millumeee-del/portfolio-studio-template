export const SITE_LANGUAGE_PAIRS=[
 ['首页','Home'],['作品','Projects'],['关于','About'],['作品集','Showreel'],['作品目录','PROJECT INDEX'],['全部作品','ALL PROJECTS'],
 ['动态 · 系统 · 现场','MOTION · SYSTEMS · LIVE'],
 ['Showreel 年份选择','Showreel year selector'],['Showreel 年份','Showreel years'],['上一个年份','Previous year'],['下一个年份','Next year'],
 ['动态设计','MOTION DESIGN'],['角色设计','CHARACTER DESIGN'],['创意编程','CREATIVE CODING'],['现场视觉','LIVE VISUAL'],
 ['作品分类滚轮','Project category wheel'],['拖动或使用上下方向键选择分类，点击或按回车浏览作品。','Drag or use the up and down arrows to choose a category. Click or press Enter to explore.'],
 ['← 返回首页','← Back to home'],['留下你的心情','Share your mood'],['修改','Edit'],['取消','Cancel'],['关闭','Close'],['删除','Delete'],['保存','Save'],['贴在这里','Stick it here'],
 ['挑一张贴纸，留一句话，把今天的心情贴在这里。','Pick a sticker, leave a note, and make yourself at home.'],
 ['想说的话','Your message'],['可不填','Optional'],['怎么称呼你','Your name'],['贴纸大小','Sticker size'],['去选一个位置','Choose a spot'],
 ['今天也有一点点开心…','A little happiness today…'],['一位路过的朋友','A passing friend'],
 ['贴上后，其他访客也能在本页看到。请不要填写私人联系方式。','Your sticker will be visible to other visitors. Please keep private contact details out.'],
 ['隐藏心情贴纸','Hide mood stickers'],['显示心情贴纸','Show mood stickers'],['显示 / 隐藏心情贴纸','Show / hide mood stickers'],['选择心情贴纸','Choose a mood sticker'],['访客心情贴纸','Visitor mood stickers'],
 ['微信联系','WeChat'],['关闭微信二维码','Close WeChat QR code'],['微信','WeChat'],['小红书','Xiaohongshu'],['目录','Menu'],
 ['查看完整项目','View full project'],['打开原项目','Open original project'],['上一个作品（←）','Previous project (←)'],['下一个作品（→）','Next project (→)'],['跳到作品内容','Skip to project content'],['作品翻页','Project navigation'],['页面层级','Breadcrumbs'],['页面导航','Page navigation'],['作品分类与目录','Project categories and index'],['主导航','Main navigation'],['社交平台与联系方式','Social links and contact'],['查看完整项目 ↗','View full project ↗']
];

// 随首屏 HTML 同步运行：记住语言并在节点出现时应用，避免先显示中文再闪到英文。
export function bootSiteLanguage(payload){
  const catalog=payload.catalog,pairs=payload.pairs,records=new WeakMap(),attributeRecords=new WeakMap();
  let language='zh';const originalTitle=document.title;
  try{language=localStorage.getItem('studio-language')==='en'?'en':'zh';}catch{}
  const ignored='script,style,noscript,template,code,pre,[data-no-translate],[contenteditable],.mood-card,[data-visual-editor],[data-project-manager],[data-gallery-editor],[data-home-layout-editor],[data-about-portrait-editor],.about-shape-toolbar,[data-home-model-picker]';
  const aliases=new Map();for(const pair of pairs){aliases.set(pair[0],pair);aliases.set(pair[1],pair);}
  function versions(raw){
    const trimmed=raw.trim(),pair=aliases.get(trimmed);
    if(pair)return {zh:raw.replace(trimmed,pair[0]),en:raw.replace(trimmed,pair[1]),fixed:true};
    const project=/^(上一个作品|下一个作品)：(.+)$/.exec(trimmed);
    if(project)return {zh:raw,en:(project[1]==='上一个作品'?'Previous project: ':'Next project: ')+(catalog[project[2].trim()]||project[2])};
    const embed=/^在 (Vimeo|Behance|Instagram) 查看(原内容|完整项目（新标签页）)$/.exec(trimmed);
    if(embed)return {zh:raw,en:'View '+(embed[2]==='原内容'?'original content':'full project')+' on '+embed[1],fixed:true};
    const count=/^(\d+) WORKS$/.exec(trimmed);if(count)return {zh:count[1]+' 个作品',en:trimmed,fixed:true};
    return {zh:raw,en:catalog[trimmed]?raw.replace(trimmed,catalog[trimmed]):raw};
  }
  function text(node){
    const parent=node.parentElement;if(!parent||parent.closest(ignored)||!node.nodeValue?.trim())return;
    const explicit=parent.closest('[data-i18n-zh]');
    if(explicit){const zh=explicit.dataset.i18nZh,en=explicit.dataset.i18nEn||catalog[zh.trim()]||zh;if(!explicit.dataset.i18nEn)versions(zh);const next=language==='en'?en:zh;if(explicit.textContent!==next)explicit.textContent=next;return;}
    let record=records.get(node);if(!record||![record.zh,record.en].includes(node.nodeValue)){record=versions(node.nodeValue);records.set(node,record);}else if(language==='en'&&!record.fixed)record.en=versions(record.zh).en;
    const next=record[language];if(node.nodeValue!==next)node.nodeValue=next;
  }
  function attrs(element){
    if(element.closest(ignored))return;let store=attributeRecords.get(element);if(!store){store={};attributeRecords.set(element,store);}
    for(const name of ['title','aria-label','placeholder','alt']){const value=element.getAttribute(name);if(!value)continue;let item=store[name];if(!item||![item.zh,item.en].includes(value))item=store[name]=versions(value);else if(language==='en'&&!item.fixed)item.en=versions(item.zh).en;if(value!==item[language])element.setAttribute(name,item[language]);}
  }
  function walk(root){
    if(root.nodeType===3){text(root);return;}
    if(root.nodeType!==1||root.matches(ignored))return;
    const iterator=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];let node;while(node=iterator.nextNode())nodes.push(node);for(const item of nodes)if(item.isConnected)text(item);
    attrs(root);for(const item of root.querySelectorAll('[title],[aria-label],[placeholder],[alt]'))attrs(item);
  }
  function controls(){for(const button of document.querySelectorAll('[data-language-switch]')){button.setAttribute('aria-label',language==='zh'?'Switch to English':'切换到中文');button.title=language==='zh'?'Switch to English':'切换到中文';button.dataset.language=language;const compact=button.querySelector('[data-language-compact]');if(compact){const label=language==='zh'?'中':'EN';if(compact.textContent!==label)compact.textContent=label;}}}
  function apply(){document.documentElement.lang=language==='en'?'en':'zh-CN';document.documentElement.dataset.siteLanguage=language;controls();if(document.body)walk(document.body);const title=document.querySelector('.work-intro h1[data-i18n-zh]');if(title)document.title=title.textContent+' | '+(document.querySelector('meta[name="application-name"]')?.content||'Studio');else{const base=originalTitle.split(' | ')[0],suffix=originalTitle.slice(base.length);document.title=versions(base)[language]+suffix;}document.dispatchEvent(new CustomEvent('site:language-change',{detail:{language}}));}
  document.addEventListener('click',event=>{if(!event.target.closest('[data-language-switch]'))return;language=language==='zh'?'en':'zh';try{localStorage.setItem('studio-language',language);}catch{}apply();});
  document.addEventListener('site:translation-update',event=>{const update=event.detail;if(update.scope&&update.scope!==payload.scope)return;Object.assign(catalog,update.translations||update);apply();});
  new MutationObserver(changes=>{for(const change of changes){if(change.type==='characterData')text(change.target);else for(const node of change.addedNodes)walk(node);}controls();}).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  apply();document.addEventListener('DOMContentLoaded',apply,{once:true});
}
