import {blockStyle,groupStyle,safeMediaUrl} from '../lib/work-content.js';
import {parseMediaEmbed,EMBED_ALLOW,embedStyle} from '../lib/media-embed.js';
export function el(tag,attrs={},text){const n=document.createElement(tag);for(const [k,v] of Object.entries(attrs)){if(v!==undefined)n.setAttribute(k,String(v));}if(text!==undefined)n.textContent=text;return n;}
export function renderWorkBlock(block,{title='',cover='',templates,ratio='4 / 3'}={}){
  const section=el('section',{class:`work-block block-${block.type}`,style:blockStyle(block),'data-content-id':block.id});
  if(block.type==='group'){const group=el('div',{class:'work-block-group',style:groupStyle(block)});for(const child of block.children||[])group.append(renderWorkBlock(child,{title,cover,templates,ratio}));section.append(group);}
  else if(block.type==='text'){if(block.heading)section.append(el('h2',{'data-edit-field':'heading'},block.heading));section.append(el('p',{'data-edit-field':'text'},block.text||''));}
  else if(block.type==='spacer')section.append(el('div',{style:`height:${block.height||48}px`,'aria-hidden':'true'}));
  else {
    const figure=el('figure',{class:`work-media${block.caption?' has-caption':''}`});
    const embed=block.type==='video'?parseMediaEmbed(block.embedUrl):null;
    if(embed){
      const wrapper=el('div',{class:'work-embed','data-embed-provider':embed.provider,style:embedStyle(block,embed)});
      if(block.embedMode==='link'){
        const link=el('a',{class:'work-project-link',href:embed.url,target:'_blank',rel:'noopener noreferrer','aria-label':`在 ${embed.label} 查看完整项目（新标签页）`}),poster=block.embedPoster||cover;
        if(poster&&safeMediaUrl(poster))link.append(el('img',{src:poster,alt:'',loading:'lazy'}));
        const label=el('span',{class:'work-project-link-label'});label.append(el('span',{},embed.label),el('strong',{},'查看完整项目 ↗'));link.append(label);wrapper.append(link);
      }else wrapper.append(el('iframe',{src:embed.src,title:`${embed.label} · ${title||'作品'}`,loading:'lazy',allow:EMBED_ALLOW,allowfullscreen:'',referrerpolicy:'strict-origin-when-cross-origin'}),el('a',{class:'work-embed-source',href:embed.url,'aria-label':`在 ${embed.label} 查看原内容`},embed.label+' ↗'));
      figure.append(wrapper);
    }
    else if(block.src&&safeMediaUrl(block.src)){const media=el(block.type==='video'?'video':'img',{src:block.src});if(block.type==='video'){media.controls=true;media.playsInline=true;media.preload='metadata';}else media.alt=block.caption||title;figure.append(media);}
    else if(block.placeholder){const p=el('div',{class:'work-preview',style:`--work-ratio:${ratio}`});const template=templates?.querySelector(`[data-placeholder="${block.placeholder}"]`);if(template)p.append(template.content.cloneNode(true));figure.append(p);}
    else figure.append(el('div',{class:'canvas-media-empty','data-import-media':''},block.type==='video'?'点击选择视频来源':'点击导入图片 / GIF'));
    if(block.caption)figure.append(el('figcaption',{'data-edit-field':'caption','data-caption':''},block.caption));section.append(figure);
  }
  return section;
}
