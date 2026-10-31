// Work text is tagged with its original source, so filtering also works in English.
export function orderedTranslationSources(items,allowed){
 const seen=new Set(),sources=new Set(allowed);
 return items.map((item,index)=>({...item,index})).sort((a,b)=>a.top-b.top||a.left-b.left||a.index-b.index).filter(item=>{
  if(typeof item.source!=='string')return false;
  item.source=item.source.trim();if(!sources.has(item.source)||seen.has(item.source))return false;
  seen.add(item.source);return true;
 }).map(item=>item.source);
}
