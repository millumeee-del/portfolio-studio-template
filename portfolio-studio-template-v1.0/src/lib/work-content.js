import { WORK_DEFAULTS } from '../data/work-defaults.js';
import { parseMediaEmbed } from './media-embed.js';

export function getWorkBlocks(work) {
  if (Array.isArray(work.blocks)) return work.blocks;
  if (work.media?.length) return work.media.map((media, i) => ({id:`media-${i}`, ...media, width:100, align:'center', gap:32}));
  return [{id:'cover', type:'image', src:'', placeholder:work.placeholder || 'orbit', width:100, align:'center', gap:32}];
}

export function draftFromWork(work) {
  return {
    title:work.title || '', titleEn:work.titleEn || '', studio:work.studio || '', year:work.year || '', summary:work.summary || '',
    cover:work.cover || '', aspectRatio:work.aspectRatio || '', contentWidth:work.contentWidth ?? null,
    titleAlign:'left', layoutMode:work.layoutMode||'flow', canvasWidth:work.canvasWidth||work.contentWidth||WORK_DEFAULTS.contentWidth,
    blocks:structuredClone(getWorkBlocks(work))
  };
}

export function safeMediaUrl(value) {
  if (!value) return true;
  if (typeof value !== 'string' || /[\u0000-\u0020\\]/.test(value)) return false;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
}

// 保存端和编辑器共用校验；文本按纯文本显示，不接收任意 HTML。
export function validateWorkDraft(input) {
  if (!input || typeof input !== 'object') throw new Error('作品数据格式不正确');
  const text = (value, name, max=20000) => {if (typeof value !== 'string' || value.length>max) throw new Error(`${name}格式不正确或过长`);return value;};
  const number = (value, min, max, fallback) => {if (value===undefined) return fallback;if (!Number.isFinite(value)||value<min||value>max) throw new Error(`数值必须在 ${min}–${max} 之间`);return value;};
  const align = value => {if (!['left','center','right'].includes(value)) throw new Error('请选择有效的对齐方式');return value;};
  const url = value => {text(value,'素材地址',2048);if (!safeMediaUrl(value)) throw new Error('素材地址需使用 /works/ 路径或完整的 http(s) 地址，空格请写成 %20');return value;};
  const title = text(input.title,'标题',160).trim();if (!title) throw new Error('请填写作品标题');
  const titleEn=text(input.titleEn??'','英文标题',240).trim();
  const ratio = text(input.aspectRatio || '', '缩略图比例',40).trim();
  if (ratio && !/^\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?$/.test(ratio)) throw new Error('缩略图比例请填写 4 / 3 这样的格式');
  if (ratio && ratio.split('/').some(part=>Number(part)<=0)) throw new Error('缩略图比例必须大于 0');
  if (!Array.isArray(input.blocks) || input.blocks.length>80) throw new Error('每个作品最多添加 80 个内容块');
  const ids = new Set();
  const canvas=input.layoutMode==='canvas';
  const canvasWidth=number(input.canvasWidth,320,1800,input.contentWidth||WORK_DEFAULTS.contentWidth);
  let total=0;
  const cleanBlock = (block, nested=false) => {
    if (++total>80) throw new Error('每个作品最多添加 80 个内容块（含并排组内的块）');
    if (!block || !['text','image','video','spacer','group'].includes(block.type)) throw new Error('内容块类型不正确');
    const id=text(block.id,'内容块 ID',100);if (!id || ids.has(id)) throw new Error('内容块 ID 不能重复');ids.add(id);
    const result={id,type:block.type,width:number(block.width,30,100,100),align:align(block.align || 'center'),gap:number(block.gap,0,160,32)};
    if(canvas&&!nested){
      const r=block.layout;if(!r||typeof r!=='object')throw new Error('画布内容缺少位置，请重新打开编辑器');
      const width=number(r.width,24,1800),height=number(r.height,24,6000),x=number(r.x,0,1800),y=number(r.y,0,20000);
      if([x,y,width,height].some(v=>v===undefined)||x+width>canvasWidth+.5)throw new Error('内容框超出了画布宽度');
      result.layout={x,y,width,height};
    }
    if(block.fit!==undefined){if(!['cover','contain'].includes(block.fit))throw new Error('请选择有效的裁切方式');result.fit=block.fit;}
    if(block.fontSize!==undefined)result.fontSize=number(block.fontSize,8,160,16);
    if (block.type==='group') {
      if (nested) throw new Error('并排组内不能再嵌套并排组');
      if (!Array.isArray(block.children)||!block.children.length||block.children.length>24) throw new Error('每个并排组需包含 1–24 个内容块');
      const columns=number(block.columns,1,4,3);if (!Number.isInteger(columns)) throw new Error('列数需为 1–4 的整数');
      return {...result,columns,columnGap:number(block.columnGap,0,80,16),rowGap:number(block.rowGap,0,160,24),mediaHeight:number(block.mediaHeight,0,900,0),children:block.children.map(child=>cleanBlock(child,true))};
    }
    if (block.type==='text') return {...result,heading:text(block.heading || '','段落标题',200),text:text(block.text || '','正文')};
    if (block.type==='spacer') return {...result,height:number(block.height,8,300,48)};
    let embed=null;
    if(block.embedUrl){
      if(block.type!=='video')throw new Error('只有视频框可以引用平台链接');
      embed=parseMediaEmbed(text(block.embedUrl,'平台链接',2048));
      if(!embed)throw new Error('请填写有效的 Vimeo 视频、Behance 项目或 Instagram 帖子 / Reel 链接');
    }
    if(block.embedMode!==undefined&&!['embed','link'].includes(block.embedMode))throw new Error('请选择有效的平台链接展示方式');
    const embedOptions=embed?{
      embedUrl:embed.url,
      ...(block.embedMode?{embedMode:block.embedMode}:{}),
      ...(block.embedPoster?{embedPoster:url(block.embedPoster)}:{})
    }:{};
    const src=embed?'':url(block.src || '');
    const placeholder=['orbit','ribbon','bloom','wave','type','grid'].includes(block.placeholder)?block.placeholder:undefined;
    if (!src && !embed && !canvas && !(block.type==='image' && placeholder)) throw new Error('请上传素材或填写素材地址');
    return {...result,src,...embedOptions,caption:text(block.caption || '','素材说明',1000),...(block.captionHeight!==undefined?{captionHeight:number(block.captionHeight,0,6000,0)}:{}),...(block.captionAlign ? {captionAlign:align(block.captionAlign)} : {}),...(!embed&&placeholder ? {placeholder}: {})};
  };
  const blocks=input.blocks.map(block=>cleanBlock(block));
  return {title,titleEn,studio:text(input.studio || '','工作室',200),year:text(input.year || '','年份',40),summary:text(input.summary || '','作品简介'),cover:url(input.cover || ''),aspectRatio:ratio,contentWidth:input.contentWidth==null?null:number(input.contentWidth,320,1800,WORK_DEFAULTS.contentWidth),titleAlign:align(input.titleAlign || 'left'),layoutMode:canvas?'canvas':'flow',...(canvas?{canvasWidth}:{}),blocks};
}

// 正式页面和本地实时预览共用，图片位置与说明文字对齐分别设置。
export function blockStyle(block) {
  return `width:${block.width??100}%;margin-left:${block.align==='left'?'0':'auto'};margin-right:${block.align==='right'?'0':'auto'};margin-bottom:${block.gap??32}px;${block.type==='text'?`text-align:${block.align||'left'};`:''}--media-caption-align:${block.captionAlign||'var(--work-caption-align)'};`;
}

export function groupStyle(block) {
  return `--block-group-columns:${block.columns??3};--block-group-column-gap:${block.columnGap??16}px;--block-group-row-gap:${block.rowGap??24}px;${block.mediaHeight>0?`--block-group-media-height:${block.mediaHeight}px;`:''}`;
}
