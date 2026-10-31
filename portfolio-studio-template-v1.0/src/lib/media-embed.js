// 浏览器预览与保存端共用；只生成这三个平台的官方嵌入地址。
export function parseMediaEmbed(value) {
  if(typeof value!=='string'||!value.trim()||value.length>2048)return null;
  let url;try{url=new URL(value.trim());}catch{return null;}
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.port)return null;
  const host=url.hostname.toLowerCase(),path=url.pathname;let match;
  if(['vimeo.com','www.vimeo.com','player.vimeo.com'].includes(host)) {
    match=host==='player.vimeo.com'?path.match(/^\/video\/([1-9]\d*)\/?$/):path.match(/^\/(?:channels\/[^/]+\/|groups\/[^/]+\/videos\/)?([1-9]\d*)(?:\/([a-zA-Z0-9]+))?\/?$/);
    if(!match)return null;
    const id=match[1],hash=url.searchParams.get('h')||match[2]||'';
    if(hash&&!/^[a-zA-Z0-9]{1,128}$/.test(hash))return null;
    const src=new URL(`https://player.vimeo.com/video/${id}`);if(hash)src.searchParams.set('h',hash);
    return {provider:'vimeo',label:'Vimeo',url:`https://vimeo.com/${id}${hash?'/'+hash:''}`,src:src.href,ratio:'16 / 9'};
  }
  if(['behance.net','www.behance.net'].includes(host)) {
    match=path.match(/^\/(?:gallery|embed\/projects)\/([1-9]\d*)(?:\/[^/]+)?\/?$/);if(!match)return null;
    // 原项目链接保留标题路径、查询参数和锚点；只有 iframe 地址按项目 ID 生成。
    const project=new URL(url);
    project.protocol='https:';project.hostname='www.behance.net';
    project.pathname=path.replace(/^\/embed\/projects\//,'/gallery/');
    return {provider:'behance',label:'Behance',url:project.href,src:`https://www.behance.net/embed/projects/${match[1]}`,ratio:'4 / 3'};
  }
  if(['instagram.com','www.instagram.com','m.instagram.com'].includes(host)) {
    match=path.match(/^\/(p|reel|tv)\/([a-zA-Z0-9_-]+)(?:\/embed)?\/?$/);if(!match)return null;
    const post=`https://www.instagram.com/${match[1]}/${match[2]}/`;
    return {provider:'instagram',label:'Instagram',url:post,src:post+'embed/',ratio:'4 / 5'};
  }
  return null;
}

export const EMBED_ALLOW='autoplay; fullscreen; picture-in-picture; encrypted-media';
export function embedStyle(block,embed) {
  return `--embed-ratio:${block.layout?`${block.layout.width} / ${block.layout.height}`:embed.ratio};`;
}
