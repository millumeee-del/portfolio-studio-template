import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {build} from 'esbuild';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
test('D1 runtime: shared persistence, page isolation, safe payloads, ownership and rate limits',async()=>{
  const bundled=await build({stdin:{contents:`import {handleMoodRequest} from './server/moods/api.js';export default {fetch(r,e){return handleMoodRequest(r,e.MOODS,{visitorKey:r.headers.get('X-Test-Visitor')||'test',pageExists:async p=>p!=='/projects/missing/'})}}`,resolveDir:root},bundle:true,write:false,format:'esm',platform:'browser'});
  const runtime=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundled.outputFiles[0].text,compatibilityDate:'2026-10-06',d1Databases:['MOODS']}));
  try{
    const db=await runtime.getD1Database('MOODS');
    for(const sql of (await readFile(path.join(root,'server/moods/schema.sql'),'utf8')).split(';').filter(sql=>sql.trim()))await db.prepare(sql).run();
    const payload=()=>({id:crypto.randomUUID(),token:'a'.repeat(64),page:'/',sticker:'smile',message:'<script>alert(1)</script>',nickname:'测试访客',x:.5,y:.4,size:136,rotation:-5});
    const send=(method,body,headers={})=>runtime.dispatchFetch('https://example.com/api/moods',{method,headers:{Origin:'https://example.com','Content-Type':'application/json',...headers},body:JSON.stringify(body)});
    const list=async page=>(await runtime.dispatchFetch('https://example.com/api/moods?page='+encodeURIComponent(page))).json();
    const item=payload();let response=await send('POST',item);assert.equal(response.status,201,await response.text());
    const saved=await list('/');assert.equal(saved.moods.length,1);assert.equal(saved.moods[0].message,item.message);assert.equal(saved.moods[0].token,undefined);assert.equal(saved.moods[0].visitor_hash,undefined);assert.equal((await list('/about/')).moods.length,0);
    response=await send('POST',item);assert.equal(response.status,200);assert.equal((await list('/')).moods.length,1,'retry must not duplicate');
    assert.equal((await send('PATCH',{...item,token:'b'.repeat(64),message:'other visitor'})).status,403);
    assert.equal((await send('PATCH',{...item,page:'/about/'})).status,403);
    const update={...item,message:'updated mood',sticker:'flower',x:.75,y:.25,size:320};
    assert.equal((await send('PATCH',update)).status,200);
    assert.equal((await list('/')).moods[0].size,320);
    assert.equal((await send('PATCH',{...update,size:361})).status,400);
    const updated=(await list('/')).moods;assert.equal(updated.length,1);assert.equal(updated[0].message,update.message);assert.equal(updated[0].x,.75);assert.equal(updated[0].created_at,saved.moods[0].created_at);
    assert.equal((await send('POST',payload(),{Origin:'https://evil.example'})).status,403);
    assert.equal((await send('POST',{...payload(),sticker:'unknown'})).status,400);
    assert.equal((await send('POST',{...payload(),x:-1})).status,400);
    assert.equal((await send('POST',{...payload(),message:'x'.repeat(101)})).status,400);
    assert.equal((await send('POST',{...payload(),page:'/projects/missing/'})).status,400);
    assert.equal((await send('POST',{...payload(),page:'https://evil.example/'})).status,400);
    assert.equal((await send('POST',{...payload(),size:'136'})).status,400);
    assert.equal((await send('POST',{...payload(),message:'x'.repeat(5000)})).status,400);
    assert.equal((await send('DELETE',{id:item.id,token:'b'.repeat(64)})).status,403);
    assert.equal((await send('DELETE',{id:item.id,token:item.token})).status,200);assert.equal((await list('/')).moods.length,0);
    assert.equal((await send('PATCH',update)).status,404);
    for(let i=0;i<8;i++)assert.equal((await send('POST',payload())).status,201);
    assert.equal((await send('POST',payload())).status,429);
    assert.equal((await send('POST',{...payload(),page:'/about/'},{'X-Test-Visitor':'another-network'})).status,201);
    assert.equal((await list('/about/')).moods.length,1);
    assert.equal((await send('POST',{...payload(),page:'/showreel/watch/',size:60},{'X-Test-Visitor':'watch-test'})).status,201);
  }finally{await runtime.dispose();}
});
