import {handleMoodRequest} from './api.js';

/** @type {ExportedHandler<Cloudflare.Env>} */
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
    return handleMoodRequest(request,env.MOODS,{
      visitorKey:request.headers.get('CF-Connecting-IP')||'unknown',
      pageExists:async page=>(await env.ASSETS.fetch(new Request(new URL(page,url),{method:'HEAD'}))).ok
    });
  }
};
