import {draftFromWork,validateWorkDraft} from '../lib/work-content.js';
import {canvasHeight,frameStyle,readingOrder,resizeCanvas,snapRect,clamp} from '../lib/work-canvas.js';
import {WORK_DEFAULTS} from '../data/work-defaults.js';
import {el,renderWorkBlock} from './work-block-dom.js';
import {parseMediaEmbed} from '../lib/media-embed.js';
import {measureContentSpacing,snapContentSpacing} from '../lib/work-spacing.js';

const names={image:'图片 / GIF',video:'视频',text:'文字',spacer:'留白',group:'并排组'};
export async function mountVisualWorkEditor(){
  const host=document.querySelector('[data-visual-editor]');if(!host||host.dataset.mounted)return;host.dataset.mounted='true';
  const q=s=>host.querySelector(s),board=q('[data-artboard]'),stage=q('[data-stage]'),paper=q('[data-paper]'),scroll=q('[data-canvas-scroll]'),inspector=q('[data-inspector]'),status=q('[data-status]');
  const category=host.dataset.category,slug=host.dataset.slug,key=`studio-work-draft:${category}/${slug}`;
  let draft,original,version,selected=null,tool='',view='desktop',showInfo=false,scale=1,extraHeight=0,gesture=null,uploadTarget=null,uploads=0,saving=false,history=[],future=[],inlineBefore=null,disposed=false,preparing=false;
  let videoSource=null;
  const listeners=[];const on=(n,type,fn,options)=>{n.addEventListener(type,fn,options);listeners.push(()=>n.removeEventListener(type,fn,options));};
  const serialize=()=>JSON.stringify(draft),block=()=>draft?.blocks.find(b=>b.id===selected),note=(text,error=false)=>{status.textContent=text;status.classList.toggle('is-error',error);};
  const cache=()=>{try{localStorage.setItem(key,serialize());}catch{}};
  const sync=()=>{q('[data-save]').disabled=!draft||saving||uploads>0;q('[data-undo]').disabled=!history.length||saving;q('[data-redo]').disabled=!future.length||saving;};
  const record=before=>{if(before!==serialize()){history.push(before);if(history.length>60)history.shift();future=[];cache();note('未保存改动 · 草稿已保留');}sync();};
  function transact(fn,{panel=true}={}){const before=serialize();fn();record(before);render({panel});}
  async function request(url,options){const r=await fetch(url,options);const result=await r.json();if(!r.ok)throw Error(result.error||'操作失败');return result;}
  function field(label,name,value,{type='text',min,max,options,rows,info=false}={}){const wrapper=el('label',{},label),input=el(options?'select':rows?'textarea':'input',info?{'data-info-field':name}:{'data-prop':name});if(options)for(const [v,t] of options)input.append(el('option',{value:v},t));else if(rows)input.rows=rows;else input.type=type;if(min!==undefined)input.min=min;if(max!==undefined)input.max=max;input.value=value??'';input.setAttribute('aria-label',label);wrapper.append(input);return wrapper;}
  function action(label,name){return el('button',{type:'button','data-action':name},label);}
  function header(){for(const name of ['title','studio','summary'])q(`[data-inline-field="${name}"]`).textContent=draft[name]||'';}
  function measureCaptions(){
    if(view!=='desktop'||!draft)return;
    for(const b of draft.blocks){if(!['image','video'].includes(b.type))continue;const frame=board.querySelector(`[data-frame-id="${b.id}"]`),caption=frame?.querySelector('figcaption');b.captionHeight=caption?Math.round((caption.getBoundingClientRect().height/scale+parseFloat(getComputedStyle(caption).marginTop))*100)/100:0;}
  }
  function measure(){
    if(!draft||preparing)return;const width=view==='mobile'?375:draft.canvasWidth;
    scale=Math.min(1,Math.max(120,scroll.clientWidth-48)/width);paper.style.width=`${width*scale}px`;
    board.style.width=`${width}px`;board.style.transform=`scale(${scale})`;board.style.setProperty('--canvas-width',String(width));board.style.setProperty('--editor-scale',String(scale));
    measureCaptions();
    const height=view==='mobile'?Math.max(100,board.scrollHeight):Math.max(700,canvasHeight(draft.blocks)+200)+extraHeight;
    board.style.setProperty('--canvas-height',String(height));stage.style.height=`${height*scale}px`;q('[data-zoom]').textContent=`${Math.round(scale*100)}% · ${view==='mobile'?'手机阅读顺序':width+'px 画布'}`;
  }
  function render({panel=true,heading=false}={}){
    if(!draft)return;board.classList.toggle('canvas-mobile-preview',view==='mobile');board.classList.toggle('is-draw-tool',!!tool&&view==='desktop');
    const nodes=[];const blocks=view==='mobile'?readingOrder(draft.blocks):draft.blocks;
    for(const b of blocks){const frame=el('div',{class:`canvas-frame${b.id===selected?' is-selected':''}`,'data-frame-id':b.id,style:frameStyle(b,draft.canvasWidth)});frame.append(renderWorkBlock(b,{title:draft.title,cover:draft.cover,templates:host,ratio:draft.aspectRatio||'4 / 3'}));
      if(b.type==='spacer')frame.querySelector('.block-spacer > div').textContent='留白';
      if(view==='desktop'&&b.id===selected){const label=el('div',{class:'canvas-frame-label','data-move-handle':''},`⠿ ${names[b.type]} · ${Math.round(b.layout.width)} × ${Math.round(b.layout.height)}`);label.append(el('button',{type:'button','data-action':'remove','aria-label':'删除内容框'},'×'));frame.append(label);
        for(const handle of ['nw','n','ne','e','se','s','sw','w'])frame.append(el('button',{type:'button',class:'canvas-handle','data-handle':handle,'aria-label':`缩放 ${handle}`}));
        frame.querySelectorAll('[data-edit-field]').forEach(n=>{n.contentEditable='plaintext-only';n.setAttribute('spellcheck','false');});
      }nodes.push(frame);
    }
    const start=el('div',{class:'canvas-start-guide','aria-hidden':'true'}),summaryGap=getComputedStyle(host).getPropertyValue('--work-summary-content-gap').trim();start.append(el('span',{},`正文起点 · ${draft.summary.trim()?'简介后 '+summaryGap+' · ':''}Y = 0`));board.replaceChildren(start,...nodes);measure();if(heading)header();if(panel)renderInspector();sync();
    q('[data-select-tool]').classList.toggle('is-active',!tool);q('[data-add-tool]').value=tool;
  }
  function renderInspector(){
    inspector.replaceChildren();const b=block();
    if(showInfo){inspector.append(el('h2',{},'作品信息'));
      for(const [name,label,rows] of [['title','作品标题（中文）'],['titleEn','作品标题（英文）'],['studio','工作室 / 客户署名'],['year','年份'],['summary','作品简介',4]])inspector.append(field(label,name,draft[name],{info:true,rows}));
      const check=el('label',{class:'canvas-check'}),input=el('input',{type:'checkbox','data-default-width':''});input.checked=draft.contentWidth==null;check.append(input,document.createTextNode('使用统一默认宽度'));inspector.append(check);
      const width=field('正文最大宽度（px）','contentWidth',draft.contentWidth||WORK_DEFAULTS.contentWidth,{type:'number',min:320,max:1800,info:true});width.querySelector('input').disabled=input.checked;inspector.append(width);
      inspector.append(el('p',{},'宽度变更会等比调整画布。默认宽度在 work-defaults.js 中统一设置。'));
      if(draft.cover)inspector.append(el('img',{src:draft.cover,alt:'列表缩略图',class:'canvas-cover-thumb'}));
      inspector.append(action('上传列表缩略图','cover'),field('缩略图地址','cover',draft.cover,{info:true}),el('p',{},'列表缩略图独立于正文素材。'),action('丢弃草稿，恢复已保存内容','discard'));return;
    }
    if(!b){inspector.append(el('h2',{},'在画面里排版'),el('p',{},'从顶部“＋ 添加”选择类型，在画布空白处拖出一个框。图片框可点击导入；视频框在右侧选择上传文件或粘贴链接。'),el('p',{},'拖动内容框改变位置，拉边缘改变大小。点击选中文字可直接输入；说明和图片一起移动。'),el('p',{},'Ctrl / ⌘ + Z 撤销，Shift + Z 重做；方向键微调，Delete 删除。按住 Alt 可暂时关闭吸附。'));return;}
    inspector.append(el('h2',{},names[b.type]+'框'));
    for(const pair of [[['x','横向位置 X'],['y','纵向位置 Y']],[['width','宽度'],['height','高度']]]){const row=el('div',{class:'canvas-pair'});for(const [name,label] of pair)row.append(field(label,'layout.'+name,Math.round(b.layout[name]),{type:'number',min:name==='x'||name==='y'?0:24,max:name==='y'?20000:name==='height'?6000:draft.canvasWidth}));inspector.append(row);}
    inspector.append(action('贴齐正文起点','align-start'));
    if(b.type==='image'||b.type==='video'){
      inspector.append(el('p',{},'宽高只控制素材画面，说明显示在框外下方，不占用素材尺寸。'));
      if(b.type==='video'){
        const mode=videoSource?.id===b.id?videoSource.mode:b.embedUrl?'link':'file';
        const source=el('label',{},'视频来源'),select=el('select',{'data-source-mode':'','aria-label':'视频来源'});
        for(const [value,label] of [['file','上传文件'],['link','粘贴链接']])select.append(el('option',{value},label));select.value=mode;source.append(select);inspector.append(source);
        if(mode==='link'){
          const label=el('label',{},'Vimeo / Behance / Instagram 链接'),input=el('input',{type:'url','data-embed-input':'','aria-label':'平台链接',placeholder:'https://vimeo.com/…'});input.value=b.embedUrl||'';label.append(input);
          inspector.append(label,action('应用链接','apply-embed'),el('p',{'data-embed-error':'',role:'alert',hidden:''}));
          const embed=parseMediaEmbed(b.embedUrl);if(embed)inspector.append(el('a',{href:embed.url,class:'canvas-platform-link'},`在 ${embed.label} 查看原内容 ↗`));
          inspector.append(field('链接展示','embedMode',b.embedMode||'embed',{options:[['embed','嵌入内容'],['link','封面＋查看完整项目']]}));
          if(b.embedMode==='link'){
            inspector.append(field('外链封面地址','embedPoster',b.embedPoster||'',{type:'url'}),action(b.embedPoster?'替换外链封面':'上传外链封面','embed-poster'));
            if(b.embedPoster)inspector.append(action('移除外链封面','remove-embed-poster'));
            inspector.append(el('p',{},'点击封面在新标签页打开原项目。封面独立保存，未设置时使用列表缩略图。'));
          }else inspector.append(el('p',{},'Vimeo 显示视频；Behance 显示项目；Instagram 显示帖子 / Reel。内容需允许嵌入，播放界面与画面比例由平台控制。'));
        }else inspector.append(action(b.src?'替换视频文件':'上传视频文件','import'));
      }else inspector.append(action(b.src?'替换素材':'导入素材','import'));
      if(!b.embedUrl||b.embedMode==='link')inspector.append(field('素材显示','fit',b.fit||'cover',{options:[['cover','填满框，裁切边缘'],['contain','完整显示，保留留白']]}));
      inspector.append(field('说明文字对齐','captionAlign',b.captionAlign||'',{options:[['','统一设置'],['left','左对齐'],['center','居中'],['right','右对齐']]}));
      inspector.append(action(b.caption?'删除说明文字':'添加说明文字',b.caption?'remove-caption':'add-caption'));
    }
    if(b.type==='text'){inspector.append(field('字号','fontSize',b.fontSize||16,{type:'number',min:8,max:160}),field('文字对齐','align',b.align||'left',{options:[['left','左对齐'],['center','居中'],['right','右对齐']]}));}
    inspector.append(action('复制内容框','duplicate'),action('删除内容框','remove'));inspector.lastElementChild.classList.add('canvas-delete');
    if(view==='mobile')inspector.append(el('p',{},'手机预览按阅读顺序排列；切回电脑排版后可以拖动和缩放。'));
  }
  function undo(redo=false){if(gesture)return;const from=redo?future:history,to=redo?history:future;if(!from.length)return;to.push(serialize());draft=JSON.parse(from.pop());videoSource=null;if(!block())selected=null;cache();render({heading:true});note(redo?'已重做 · 尚未保存':'已撤销 · 尚未保存');}
  function pickMedia(id){const b=draft.blocks.find(b=>b.id===id);if(!b)return;uploadTarget=id;const input=q('[data-media-file]');input.accept=b.type==='video'?'.mp4,.m4v,.webm':'.gif,.png,.jpg,.jpeg,.webp,.avif';input.value='';input.click();}
  function create(type,r){if(draft.blocks.length>=80){tool='';render();note('每个作品最多添加 80 个内容框',true);return null;}const b={id:crypto.randomUUID(),type,width:100,align:type==='text'?'left':'center',gap:32,layout:r,...(type==='text'?{text:'点击输入文字',heading:'',fontSize:16}:type==='spacer'?{height:r.height}:{src:'',caption:'素材说明',captionAlign:'left',fit:'cover'})};transact(()=>{draft.blocks.push(b);selected=b.id;tool='';showInfo=false;});return b;}
  function point(event){const r=board.getBoundingClientRect();return {x:clamp((event.clientX-r.left)/scale,0,draft.canvasWidth),y:Math.max(0,(event.clientY-r.top)/scale)};}
  function guides(values=[]){board.querySelectorAll('.canvas-guide').forEach(n=>n.remove());for(const g of values)board.append(el('div',{class:`canvas-guide ${g.axis}`,style:g.axis==='vertical'?`left:${g.value}px`:`top:${g.value}px`}));}
  function spacingGuides(values=[]){
    board.querySelectorAll('.canvas-spacing-guide').forEach(n=>n.remove());
    if(!q('[data-spacing-guides]').checked)return;
    for(const guide of values){if(guide.gap<.5)continue;const value=Math.round(guide.gap*10)/10,label=`${guide.kind==='start'?'距正文起点 ':guide.kind==='equal'?'等距 ':guide.kind==='reference'?'参考 ':''}${value} px`,node=el('div',{class:`canvas-spacing-guide is-${guide.kind}`,'data-spacing-gap':String(value),'aria-hidden':'true',style:`left:${clamp(guide.x,8,draft.canvasWidth-100/scale)}px;top:${guide.from}px;height:${guide.to-guide.from}px`});node.append(el('span',{},label));board.append(node);}
  }
  function updateGesture(event){
    if(!gesture)return;const p=point(event),g=gesture,dx=p.x-g.start.x,dy=p.y-g.start.y;if(Math.hypot(dx,dy)>3)g.moved=true;
    if(g.kind==='draw'){const r={x:Math.min(p.x,g.start.x),y:Math.min(p.y,g.start.y),width:Math.abs(dx),height:Math.abs(dy)};g.rect=r;let outline=board.querySelector('.canvas-draw-outline');if(!outline){outline=el('div',{class:'canvas-draw-outline'});board.append(outline);}Object.assign(outline.style,{left:r.x+'px',top:r.y+'px',width:r.width+'px',height:r.height+'px'});return;}
    const b=draft.blocks.find(b=>b.id===g.id);if(!b)return;let r={...g.original};
    if(g.kind==='move'){r.x+=dx;r.y+=dy;}
    else{if(g.handle.includes('e'))r.width+=dx;if(g.handle.includes('s'))r.height+=dy;if(g.handle.includes('w')){r.x+=dx;r.width-=dx;}if(g.handle.includes('n')){r.y+=dy;r.height-=dy;}if(event.shiftKey){r.height=r.width/(g.original.width/g.original.height);}}
    const others=draft.blocks.filter(item=>item.id!==g.id),enabled=q('[data-snap]').checked&&!event.altKey;
    const snapped=snapRect(r,others.map(item=>item.layout),draft.canvasWidth,{resize:g.kind==='resize',grid:enabled});
    b.layout=snapped.rect;
    if(g.kind==='move'&&enabled&&q('[data-spacing-guides]').checked){const spaced=snapContentSpacing({...b,layout:{...b.layout,y:clamp(r.y,0,20000-b.layout.height)}},others);if(spaced.snapped){b.layout=spaced.layout;snapped.guides=snapped.guides.filter(guide=>guide.axis!=='horizontal');}}
    if(g.kind==='move'&&enabled&&r.y<=6){b.layout.y=0;snapped.guides=snapped.guides.filter(guide=>guide.axis!=='horizontal');snapped.guides.push({axis:'horizontal',value:0});}
    const frame=board.querySelector(`[data-frame-id="${g.id}"]`);frame.style.cssText=frameStyle(b,draft.canvasWidth);const label=frame.querySelector('.canvas-frame-label');if(label)label.firstChild.textContent=`⠿ ${names[b.type]} · ${Math.round(b.layout.width)} × ${Math.round(b.layout.height)}`;guides(event.altKey?[]:snapped.guides);measure();
    const spaced=snapContentSpacing(b,others,{enabled:false});
    if(g.kind==='move'&&enabled&&q('[data-spacing-guides]').checked){const match=snapContentSpacing(b,others,{threshold:.1});spacingGuides(match.snapped?match.guides:spaced.guides);}else spacingGuides(spaced.guides);
    if(event.clientY>scroll.getBoundingClientRect().bottom-35)scroll.scrollTop+=12;
  }
  on(board,'pointerdown',event=>{
    if(!draft||view==='mobile'||event.button!==0||event.target.closest('button[data-action]'))return;
    if(event.target.closest('[contenteditable]'))return;
    const p=point(event),frame=event.target.closest('[data-frame-id]');
    if(tool&&!frame){gesture={kind:'draw',start:p,before:serialize(),type:tool,moved:false};}
    else if(frame){const id=frame.dataset.frameId,b=draft.blocks.find(b=>b.id===id),handle=event.target.closest('[data-handle]')?.dataset.handle,allowImport=!handle&&!event.target.closest('[data-move-handle]');if(selected!==id){selected=id;showInfo=false;render();}gesture={kind:handle?'resize':'move',handle,id,start:p,original:{...b.layout},before:serialize(),moved:false,allowImport};}
    else{selected=null;showInfo=false;render();return;}
    board.focus({preventScroll:true});board.setPointerCapture(event.pointerId);event.preventDefault();
  });
  on(board,'pointermove',event=>{if(gesture)updateGesture(event);});
  on(board,'pointerup',event=>{
    if(!gesture)return;const g=gesture;gesture=null;if(board.hasPointerCapture(event.pointerId))board.releasePointerCapture(event.pointerId);guides();spacingGuides();
    if(g.kind==='draw'){board.querySelector('.canvas-draw-outline')?.remove();let r=g.rect;if(!g.moved||!r||r.width<24||r.height<24)r={x:g.start.x,y:g.start.y,width:Math.min(280,draft.canvasWidth),height:g.type==='text'?100:g.type==='spacer'?64:220};const snapped=snapRect(r,[],draft.canvasWidth,{resize:true,grid:q('[data-snap]').checked});create(g.type,snapped.rect);note(g.type==='video'?'已创建视频框 · 在右侧上传文件或粘贴链接':'已创建内容框 · 点击空框导入素材，或直接编辑文字');}
    else{record(g.before);render();const b=draft.blocks.find(b=>b.id===g.id);if(!g.moved&&g.allowImport&&b?.type==='image'&&!b.src)pickMedia(b.id);}
  });
  on(board,'pointercancel',()=>{if(!gesture)return;if(gesture.id){const b=draft.blocks.find(b=>b.id===gesture.id);if(b)b.layout=gesture.original;}gesture=null;render();});
  on(host,'focusin',event=>{if(event.target.matches('[contenteditable],[data-prop],[data-info-field]'))inlineBefore=serialize();});
  on(host,'input',event=>{
    const target=event.target;if(!draft)return;
    if(target.dataset.inlineField){draft[target.dataset.inlineField]=target.innerText;cache();note('未保存改动 · 草稿已保留');return;}
    if(target.dataset.editField){const id=target.closest('[data-frame-id]')?.dataset.frameId,b=draft.blocks.find(b=>b.id===id);if(b){b[target.dataset.editField]=target.innerText;cache();note('未保存改动 · 草稿已保留');}return;}
    if(target.dataset.prop){const b=block();if(!b)return;const name=target.dataset.prop,value=target.type==='number'?target.valueAsNumber:target.value;if(target.type==='number'&&!Number.isFinite(value))return;
      if(name.startsWith('layout.')){const r={...b.layout,[name.split('.')[1]]:value};b.layout=snapRect(r,[],draft.canvasWidth,{grid:false,resize:true}).rect;}else b[name]=value;cache();render({panel:false});note('未保存改动 · 草稿已保留');return;}
    if(target.dataset.infoField){const name=target.dataset.infoField;if(name==='contentWidth'){if(!Number.isFinite(target.valueAsNumber)||target.valueAsNumber<320||target.valueAsNumber>1800)return;draft.contentWidth=target.valueAsNumber;resizeCanvas(draft,draft.contentWidth);}else draft[name]=target.value;cache();render({panel:false,heading:true});note('未保存改动 · 草稿已保留');}
  });
  on(host,'focusout',event=>{
    if(!inlineBefore)return;const target=event.target;if(!target.matches('[contenteditable],[data-prop],[data-info-field]'))return;
    const b=block();if(target.dataset.editField&&b?.type==='text'){const node=target.closest('.block-text');if(node)b.layout.height=Math.max(b.layout.height,node.scrollHeight);}
    record(inlineBefore);inlineBefore=null;if(target.dataset.editField)render({panel:false});else measure();
  });
  on(host,'change',event=>{const target=event.target;if(target.dataset.prop==='embedMode')renderInspector();if(target.hasAttribute('data-source-mode')&&block()?.type==='video'){videoSource={id:selected,mode:target.value};renderInspector();}if(target.hasAttribute('data-default-width')){transact(()=>{draft.contentWidth=target.checked?null:draft.canvasWidth;resizeCanvas(draft,draft.contentWidth||WORK_DEFAULTS.contentWidth);});}});
  on(host,'keydown',event=>{if(event.target.matches('[data-embed-input]')&&event.key==='Enter'){event.preventDefault();inspector.querySelector('[data-action="apply-embed"]')?.click();}});
  on(host,'click',async event=>{
    const action=event.target.closest('[data-action]')?.dataset.action;if(!action||!draft)return;
    if(action==='cover'){q('[data-cover-file]').click();return;}if(action==='import'){pickMedia(selected);return;}
    if(action==='discard'){draft=draftFromWork(original);history=[];future=[];selected=null;localStorage.removeItem(key);await prepare();note('已恢复已保存内容');return;}
    const b=block();if(!b)return;
    if(action==='embed-poster'){uploadTarget=b.id;q('[data-embed-poster-file]').click();return;}
    if(action==='remove-embed-poster'){transact(()=>{delete b.embedPoster;});return;}
    if(action==='align-start'){transact(()=>{b.layout.y=0;});note('已贴齐正文起点 · 简介下方保留统一间距');return;}
    if(action==='apply-embed'&&b.type==='video'){
      const input=inspector.querySelector('[data-embed-input]'),embed=parseMediaEmbed(input.value),error=inspector.querySelector('[data-embed-error]');
      if(!embed){error.hidden=false;error.textContent='请粘贴 Vimeo 视频、Behance 项目或 Instagram 帖子 / Reel 的完整链接。';input.setAttribute('aria-invalid','true');input.focus();return;}
      transact(()=>{b.embedUrl=embed.url;b.src='';if(!b.embedMode&&embed.provider==='behance')b.embedMode='link';delete b.placeholder;});note(`已应用 ${embed.label} 链接 · 保存后同步到作品页`);return;
    }
    if(action==='remove')transact(()=>{draft.blocks=draft.blocks.filter(item=>item.id!==b.id);selected=null;});
    if(action==='duplicate')transact(()=>{const clone=structuredClone(b);clone.id=crypto.randomUUID();clone.layout.x=Math.min(draft.canvasWidth-clone.layout.width,clone.layout.x+16);clone.layout.y+=24;draft.blocks.push(clone);selected=clone.id;});
    if(action==='remove-caption'||action==='add-caption')transact(()=>{b.caption=action==='remove-caption'?'':'素材说明';});
  });
  on(q('[data-add-tool]'),'change',event=>{tool=event.target.value;view='desktop';q('[data-view]').value=view;selected=null;showInfo=false;render();note('在画布空白处拖出一个框；按 Esc 取消');});
  on(q('[data-select-tool]'),'click',()=>{tool='';render();});
  on(q('[data-view]'),'change',event=>{view=event.target.value;tool='';render();note(view==='mobile'?'手机预览 · 按从上到下、从左到右的阅读顺序排列':'电脑排版 · 可以自由拖动和缩放');});
  on(q('[data-info]'),'click',()=>{showInfo=!showInfo;renderInspector();});
  on(q('[data-undo]'),'click',()=>undo());on(q('[data-redo]'),'click',()=>undo(true));on(q('[data-extend]'),'click',()=>{extraHeight+=500;measure();scroll.scrollTo({top:scroll.scrollHeight,behavior:'smooth'});});
  on(window,'keydown',event=>{
    if(!draft||disposed)return;const editing=event.target.closest('input,textarea,select,[contenteditable]');
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();q('[data-save]').click();return;}
    if(editing)return;
    if(event.key==='Enter'&&tool&&event.target===board){event.preventDefault();create(tool,{x:24,y:draft.blocks.length?canvasHeight(draft.blocks):0,width:Math.min(300,draft.canvasWidth-48),height:tool==='text'?100:tool==='spacer'?64:220});return;}
    if((event.ctrlKey||event.metaKey)&&['z','y'].includes(event.key.toLowerCase())){event.preventDefault();undo(event.shiftKey||event.key.toLowerCase()==='y');return;}
    if(event.key==='Escape'){tool='';selected=null;render();return;}const b=block();if(!b||view==='mobile')return;
    if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();transact(()=>{draft.blocks=draft.blocks.filter(item=>item.id!==b.id);selected=null;});}
    const moves={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(moves[event.key]){event.preventDefault();const [x,y]=moves[event.key],step=event.shiftKey?10:1;transact(()=>{b.layout.x=clamp(b.layout.x+x*step,0,draft.canvasWidth-b.layout.width);b.layout.y=Math.max(0,b.layout.y+y*step);});}
  });
  async function upload(input,cover=false,poster=false){if(!input.files?.length||!draft)return;const file=input.files[0],id=uploadTarget;uploads++;sync();note('正在导入素材…');
    try{if(poster&&!/^image\/(gif|png|jpeg|webp|avif)$/.test(file.type))throw Error('外链封面请选择图片文件');if(file.size>200*1024*1024)throw Error('单个素材最多 200 MB');const result=await request('/__portfolio-editor/upload',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-File-Name':encodeURIComponent(file.name)},body:file});transact(()=>{if(cover)draft.cover=result.src;else{const b=draft.blocks.find(b=>b.id===id);if(b){if(poster)b.embedPoster=result.src;else{b.src=result.src;delete b.embedUrl;delete b.embedMode;delete b.embedPoster;delete b.placeholder;}}}});note('素材已导入 · 保存后应用到作品页');}
    catch(error){note(error.message,true);}finally{uploads--;sync();input.value='';}}
  on(q('[data-media-file]'),'change',event=>upload(event.target));on(q('[data-cover-file]'),'change',event=>upload(event.target,true));
  on(q('[data-embed-poster-file]'),'change',event=>upload(event.target,false,true));
  on(q('[data-save]'),'click',async()=>{
    if(!draft||saving||uploads)return;
    try{measureCaptions();const before=structuredClone(draft);before.blocks=readingOrder(before.blocks);const clean=validateWorkDraft(before);saving=true;sync();cache();note('正在保存…');const result=await request('/__portfolio-editor/work',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({category,slug,version,draft:clean})});original=result.work;version=result.version;draft=draftFromWork(original);localStorage.removeItem(key);history=[];future=[];render({heading:true});note('已保存 · 正式作品页已同步');}
    catch(error){note(error.message,true);}finally{saving=false;sync();}
  });
  async function prepare(){
    if(draft.layoutMode!=='canvas'||draft.blocks.some(b=>!b.layout)){
      preparing=true;
      const width=draft.contentWidth||WORK_DEFAULTS.contentWidth;draft.canvasWidth=width;board.style.width=width+'px';board.style.transform='none';board.style.aspectRatio='auto';board.replaceChildren(...draft.blocks.map(b=>renderWorkBlock(b,{title:draft.title,templates:host,ratio:draft.aspectRatio||'4 / 3'})));
      const mediaReady=[...board.querySelectorAll('img')].map(img=>img.decode());
      for(const video of board.querySelectorAll('video'))if(video.readyState<1)mediaReady.push(new Promise(resolve=>{video.addEventListener('loadedmetadata',resolve,{once:true});video.addEventListener('error',resolve,{once:true});}));
      await Promise.race([Promise.allSettled(mediaReady),new Promise(resolve=>setTimeout(resolve,1800))]);
      const origin=board.getBoundingClientRect(),next=[];
      function convert(b,node){const box=node.getBoundingClientRect(),media=['image','video'].includes(b.type)?node.querySelector('.work-media > img,.work-media > video,.work-embed,.work-preview,.canvas-media-empty'):null;const r={x:clamp(box.x-origin.x,0,width-24),y:Math.max(0,box.y-origin.y),width:Math.min(width,Math.max(24,box.width)),height:Math.max(24,media?media.getBoundingClientRect().height:box.height)};r.x=Math.min(r.x,width-r.width);next.push({...b,layout:r});}
      draft.blocks.forEach((b,i)=>{const node=board.children[i];if(b.type==='group'){const children=node.querySelector('.work-block-group').children;(b.children||[]).forEach((child,index)=>convert(child,children[index]));}else convert(b,node);});draft.blocks=next;draft.layoutMode='canvas';board.style.aspectRatio='';preparing=false;
    }
    const desiredWidth=draft.contentWidth||WORK_DEFAULTS.contentWidth;
    if(draft.canvasWidth!==desiredWidth)resizeCanvas(draft,desiredWidth);
    header();render();
  }
  const resizeObserver=new ResizeObserver(()=>{if(!gesture)measure();});resizeObserver.observe(scroll);
  const dispose=()=>{disposed=true;resizeObserver.disconnect();listeners.forEach(remove=>remove());};on(document,'astro:before-swap',dispose,{once:true});
  try{const result=await request(`/__portfolio-editor/work?${new URLSearchParams({category,slug})}`);if(disposed)return;original=result.work;version=result.version;draft=draftFromWork(original);let restored=false;try{const cached=JSON.parse(localStorage.getItem(key)||'null');if(cached&&Array.isArray(cached.blocks)){draft={...draft,...cached};restored=true;}}catch{}
    await prepare();sync();note(restored?'已恢复未保存草稿 · 可以继续排版':'已载入 · 从“＋ 添加”选类型，在画面里拖出内容框');
  }catch(error){note('无法打开编辑器：'+error.message,true);}
}
