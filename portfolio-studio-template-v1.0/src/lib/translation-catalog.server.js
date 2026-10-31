import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {normalizeTranslationScope} from './scoped-translations.js';
const sourceRoot=fileURLToPath(new URL('../../',import.meta.url));
export const translationRoot=existsSync(path.join(sourceRoot,'src/data/works.json'))?sourceRoot:process.cwd();
export const translationFile=path.join(translationRoot,'src/data/translations.en.json');
export function readTranslationStore(){try{return JSON.parse(readFileSync(translationFile,'utf8'));}catch{return {version:1,entries:{}};}}
export function readTranslationCatalog(scope='/'){
  const store=readTranslationStore(),catalog=Object.fromEntries(Object.entries(store.entries||{}).map(([source,item])=>[source,item.en]));
  const works=JSON.parse(readFileSync(path.join(translationRoot,'src/data/works.json'),'utf8'));
  // Project titles also appear on cards and in the directory, outside their own page.
  for(const work of works){const title=store.scopes?.['/projects/'+work.category+'/'+work.slug+'/']?.entries?.[work.title.trim()];if(title)catalog[work.title.trim()]=title.en;}
  for(const [source,item] of Object.entries(store.scopes?.[normalizeTranslationScope(scope)]?.entries||{}))catalog[source]=item.en;
  for(const work of works)if(work.titleEn?.trim())catalog[work.title.trim()]=work.titleEn;
  return catalog;
}
export function translationSources(scope){
  const source=new Set(),add=text=>{if(typeof text==='string'&&/[\u3400-\u9fff]/.test(text)&&text.trim())source.add(text.trim());};
  const works=JSON.parse(readFileSync(path.join(translationRoot,'src/data/works.json'),'utf8'));
  function blocks(items){for(const b of items||[]){for(const key of ['text','heading','caption'])add(b[key]);blocks(b.children);}}
  if(scope!==undefined){
    scope=normalizeTranslationScope(scope);
    const work=works.find(work=>'/projects/'+work.category+'/'+work.slug+'/'===scope);
    if(work){for(const key of ['title','studio','summary'])add(work[key]);blocks(work.blocks);for(const media of work.media||[])add(media.caption);return [...source];}
    if(scope==='/projects/'||works.some(work=>'/projects/'+work.category+'/'===scope)){for(const work of works)if(scope==='/projects/'||scope==='/projects/'+work.category+'/')add(work.title);return [...source];}
    if(scope==='/')return [];
    if(scope!=='/about/')throw new Error('请打开具体作品后编辑英文');
  }else for(const work of works){for(const key of ['title','studio','summary'])add(work[key]);blocks(work.blocks);for(const media of work.media||[])add(media.caption);}
  const about=JSON.parse(readFileSync(path.join(translationRoot,'src/data/about-portrait.json'),'utf8'));
  for(const block of about.textBlocks||[])add(block.text);
  if(scope===undefined)for(const c of JSON.parse(readFileSync(path.join(translationRoot,'src/data/categories.json'),'utf8')))add(c.label);
  return [...source];
}
