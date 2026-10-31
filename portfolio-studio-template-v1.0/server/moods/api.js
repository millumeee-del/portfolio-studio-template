import {MOOD_STICKERS, MOOD_SETTINGS} from '../../src/lib/mood-stickers.js';

const publicColumns='id,page,sticker,message,nickname,x,y,size,rotation,created_at';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const tokenPattern=/^[0-9a-f]{64}$/;
const pages=/^(?:\/(?:about|showreel(?:\/watch)?)\/|\/projects\/(?:[a-z0-9-]+\/(?:[a-z0-9-]+\/)?)?)$|^\/$/;
export const moodJson=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function digest(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,'0')).join('');}
async function readBody(request){
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new Error('请使用 JSON 提交');
  if(Number(request.headers.get('content-length')||0)>4096)throw new Error('留言太长了');
  const reader=request.body?.getReader();if(!reader)throw new Error('缺少留言');
  let bytes=0;const chunks=[];
  try{while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>4096)throw new Error('留言太长了');chunks.push(value);}}
  finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  const all=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.length;}
  try{return JSON.parse(new TextDecoder().decode(all));}catch{throw new Error('留言格式有误');}
}
function validPage(page){return typeof page==='string'&&page.length<=200&&pages.test(page);}
function cleanText(value,max){if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b-\u001f\u007f]/.test(value))throw new Error('文字内容或长度有误');return value.trim();}
export async function handleMoodRequest(request,db,{visitorKey='local',pageExists=async()=>true}={}){
  const url=new URL(request.url);
  if(url.pathname!=='/api/moods')return moodJson({error:'找不到这个接口'},404);
  try{
    if(request.method==='GET'){
      const page=url.searchParams.get('page');if(!validPage(page))return moodJson({error:'页面地址有误'},400);
      const rows=await db.prepare(`SELECT ${publicColumns} FROM moods WHERE page=? ORDER BY created_at DESC,id DESC LIMIT ?`).bind(page,MOOD_SETTINGS.pageLimit).all();
      return moodJson({moods:rows.results.reverse()});
    }
    if(!['POST','PATCH','DELETE'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, POST, PATCH, DELETE'}});
    if(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site')return moodJson({error:'请在本站页面提交'},403);
    let data;try{data=await readBody(request);}catch(error){return moodJson({error:error.message},400);}
    if(!data||!uuid.test(data.id)||!tokenPattern.test(data.token))return moodJson({error:'留言凭据有误'},400);
    const deleteHash=await digest(data.token);
    if(request.method==='DELETE'){
      const result=await db.prepare('DELETE FROM moods WHERE id=? AND delete_hash=?').bind(data.id,deleteHash).run();
      return result.meta.changes?moodJson({deleted:true}):moodJson({error:'只能移除你自己贴的留言'},403);
    }
    const page=data.page;
    if(!validPage(page)||!await pageExists(page))return moodJson({error:'这个页面不存在'},400);
    if(data.website)return moodJson({error:'暂时无法提交'},400);
    let message,nickname;
    try{message=cleanText(data.message,MOOD_SETTINGS.maxText);nickname=cleanText(data.nickname,MOOD_SETTINGS.maxNickname);}catch(error){return moodJson({error:error.message},400);}
    if(!MOOD_STICKERS.some(item=>item.id===data.sticker)||
      ![data.x,data.y,data.size,data.rotation].every(Number.isFinite)||data.x<0||data.x>1||data.y<0||data.y>1||
      data.size<MOOD_SETTINGS.minSize||data.size>MOOD_SETTINGS.maxSize||Math.abs(data.rotation)>20)return moodJson({error:'贴纸位置或尺寸有误'},400);
    const previous=await db.prepare(`SELECT ${publicColumns},delete_hash FROM moods WHERE id=?`).bind(data.id).first();
    if(request.method==='PATCH'){
      if(!previous)return moodJson({error:'这张贴纸已被移除'},404);
      if(previous.delete_hash!==deleteHash||previous.page!==page)return moodJson({error:'只能修改你自己贴的留言'},403);
      const result=await db.prepare('UPDATE moods SET sticker=?,message=?,nickname=?,x=?,y=?,size=?,rotation=? WHERE id=? AND delete_hash=? AND page=?')
        .bind(data.sticker,message,nickname,data.x,data.y,Math.round(data.size),data.rotation,data.id,deleteHash,page).run();
      if(!result.meta.changes)return moodJson({error:'这张贴纸已被移除'},404);
      return moodJson({mood:{id:data.id,page,sticker:data.sticker,message,nickname,x:data.x,y:data.y,size:Math.round(data.size),rotation:data.rotation,created_at:previous.created_at}});
    }
    if(previous){if(previous.delete_hash!==deleteHash)return moodJson({error:'这张贴纸已存在'},409);delete previous.delete_hash;return moodJson({mood:previous},200);}
    const now=Date.now(),visitorHash=await digest(Math.floor(now/86400000)+':'+visitorKey);
    // 单条 SQL 同时检查频率并写入，避免并发提交绕过限制。不保存原始 IP。
    const result=await db.prepare(`INSERT INTO moods (${publicColumns},delete_hash,visitor_hash)
      SELECT ?,?,?,?,?,?,?,?,?,?,?,?
      WHERE (SELECT COUNT(*) FROM moods WHERE visitor_hash=? AND created_at>?)<8
      AND (SELECT COUNT(*) FROM moods WHERE page=?)<300`).bind(
        data.id,page,data.sticker,message,nickname,data.x,data.y,Math.round(data.size),data.rotation,now,deleteHash,visitorHash,
        visitorHash,now-3600000,page).run();
    if(!result.meta.changes)return moodJson({error:'先休息一下，这页的心情已经很丰富啦。稍后再来贴吧。'},429);
    return moodJson({mood:{id:data.id,page,sticker:data.sticker,message,nickname,x:data.x,y:data.y,size:Math.round(data.size),rotation:data.rotation,created_at:now}},201);
  }catch(error){console.error(JSON.stringify({event:'mood_api_error',message:error.message}));return moodJson({error:'留言暂时无法保存，请稍后再试'},503);}
}
