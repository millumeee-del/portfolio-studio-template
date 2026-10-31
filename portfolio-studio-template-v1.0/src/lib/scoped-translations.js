export function normalizeTranslationScope(value){
 if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||/[?#\\]/.test(value))throw new Error('请刷新页面后再编辑英文');
 const scope=value.replace(/^\/edit\//,'/projects/');return scope.endsWith('/')?scope:scope+'/';
}
export function scopedTranslationEntries(store,scope){
 return {...store.entries,...store.scopes?.[normalizeTranslationScope(scope)]?.entries};
}
export function applyScopedTranslationEdits(store,scope,entries,allowed){
 scope=normalizeTranslationScope(scope);const sources=new Set(allowed);
 if(!Array.isArray(entries)||entries.length>300)throw new Error('译文格式有误');
 for(const item of entries)if(!item||!sources.has(item.source)||typeof item.en!=='string'||item.en.length>40000)throw new Error('只能修改当前帖子的英文');
 const next=structuredClone(store);next.version=2;next.scopes??={};next.scopes[scope]??={entries:{}};
 for(const item of entries)next.scopes[scope].entries[item.source]={en:item.en.trim()?item.en:'',manual:true};
 return next;
}
