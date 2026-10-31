import {translationSources,readTranslationStore} from '../src/lib/translation-catalog.server.js';
import {saveTranslationEdits} from './manual-translations.mjs';
import {normalizeTranslationScope,scopedTranslationEntries} from '../src/lib/scoped-translations.js';
export default function localTranslations(){return {name:'local-manual-translations',apply:'serve',configureServer(server){
  server.middlewares.use(async(req,res,next)=>{
    const route=(req.url||'').split('?')[0];if(!['/api/translations','/__portfolio-editor/translations'].includes(route))return next();
    const base='http://'+req.headers.host;
    const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
    if(!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(req.headers.host||'')||(req.headers.origin&&req.headers.origin!==base))return reply(403,{error:'仅支持本地编辑'});
    if(route==='/api/translations')return reply(410,{error:'自动翻译已关闭，请在译文微调中手动填写英文'});
    try{
      if(req.method==='GET'){const scope=normalizeTranslationScope(new URL(req.url,base).searchParams.get('scope'));return reply(200,{scope,sources:translationSources(scope),entries:scopedTranslationEntries(readTranslationStore(),scope),automatic:false});}
      if(req.method!=='POST'||!req.headers['content-type']?.startsWith('application/json'))return reply(405,{error:'请提交 JSON'});
      const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>512*1024)throw new Error('请求过大');chunks.push(chunk);}const data=JSON.parse(Buffer.concat(chunks));
      const scope=normalizeTranslationScope(data.scope),saved=await saveTranslationEdits(data.entries,scope);return reply(200,{scope,entries:scopedTranslationEntries(saved,scope)});
    }catch(error){reply(400,{error:error.message});}
  });
}};}
