import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {Readable} from 'node:stream';
import {moodJson} from '../server/moods/api.js';

const root=fileURLToPath(new URL('../',import.meta.url));
export function sqliteMoodAdapter(sqlite){return {prepare(sql){const statement=sqlite.prepare(sql);let values=[];return {bind(...args){values=args;return this;},async all(){return {results:statement.all(...values)};},async first(){return statement.get(...values)||null;},async run(){const result=statement.run(...values);return {meta:{changes:Number(result.changes)}};}};}};}
export default function localMoods(){
  let sqlite;
  return {name:'local-mood-guestbook',apply:'serve',configureServer(server){
    server.middlewares.use(async(req,res,next)=>{
      const pathname=(req.url||'').split('?')[0];if(pathname!=='/api/moods'&&pathname!=='/__mood-admin')return next();
      if(!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(req.headers.host||'')){res.writeHead(403);res.end();return;}
      const base='http://'+req.headers.host;
      if(req.headers.origin&&req.headers.origin!==base){res.writeHead(403);res.end();return;}
      try{
        if(!sqlite){mkdirSync(path.join(root,'.visitor-data'),{recursive:true});sqlite=new DatabaseSync(path.join(root,'.visitor-data/moods.sqlite'));sqlite.exec('PRAGMA journal_mode=WAL');sqlite.exec(readFileSync(path.join(root,'server/moods/schema.sql'),'utf8'));}
        let response;
        if(pathname==='/__mood-admin'){
          if(req.method==='GET')response=moodJson({moods:sqlite.prepare('SELECT id,page,sticker,message,nickname,created_at FROM moods ORDER BY created_at DESC LIMIT 300').all(),local:true});
          else if(req.method==='DELETE'&&req.headers.origin===base){const id=new URL(req.url,base).searchParams.get('id');sqlite.prepare('DELETE FROM moods WHERE id=?').run(id||'');response=moodJson({deleted:true});}
          else response=moodJson({error:'不支持的操作'},405);
        }else{
          const request=new Request(new URL(req.url,base),{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{})});
          // 通过 Vite 加载接口模块，让本地调整后立即生效，无需重启整站。
          const {handleMoodRequest}=await server.ssrLoadModule('/server/moods/api.js');
          response=await handleMoodRequest(request,sqliteMoodAdapter(sqlite),{visitorKey:'local-preview'});
        }
        res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
      }catch(error){server.config.logger.error('心情留言：'+error.message);res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'本地留言服务暂不可用'}));}
    });
    server.httpServer?.once('close',()=>{sqlite?.close();sqlite=null;});
  }};
}
