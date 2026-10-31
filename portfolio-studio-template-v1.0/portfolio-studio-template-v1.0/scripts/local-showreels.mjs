import {readFile,writeFile,rename} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validateShowreelSettings} from '../src/lib/showreel-settings.js';

export function createShowreelStore(file){
  if(file instanceof URL)file=fileURLToPath(file);
  let queue=Promise.resolve();
  const read=async()=>{const raw=await readFile(file,'utf8');return {settings:validateShowreelSettings(JSON.parse(raw)),version:createHash('sha256').update(raw).digest('hex')};};
  function save(settings,version){
    const task=queue.then(async()=>{
      const current=await read();if(current.version!==version)throw Object.assign(new Error('内容已在另一处更新，请关闭后重新打开编辑器。'),{status:409});
      const clean=validateShowreelSettings(settings),temp=file+'.'+randomUUID()+'.tmp';
      await writeFile(temp,JSON.stringify(clean,null,2)+'\n',{flag:'wx'});await rename(temp,file);return read();
    });queue=task.catch(()=>{});return task;
  }
  return {read,save};
}

export default function localShowreels(){
  const store=createShowreelStore(new URL('../src/data/showreels.json',import.meta.url));
  return {name:'local-showreel-settings',apply:'serve',configureServer(server){server.middlewares.use(async(req,res,next)=>{
    if((req.url||'').split('?')[0]!=='/__portfolio-editor/showreels')return next();
    const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
    if(!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(req.headers.host||'')||(req.headers.origin&&req.headers.origin!=='http://'+req.headers.host))return reply(403,{error:'仅支持本地编辑'});
    try{
      if(req.method==='GET')return reply(200,await store.read());
      if(req.method!=='POST'||!req.headers['content-type']?.startsWith('application/json'))return reply(405,{error:'请提交 JSON'});
      const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>32*1024)throw new Error('请求过大');chunks.push(chunk);}
      const data=JSON.parse(Buffer.concat(chunks));reply(200,await store.save(data.settings,data.version));
    }catch(error){reply(error.status||400,{error:error.message});}
  });}};
}
