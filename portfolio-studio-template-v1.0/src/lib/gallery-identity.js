// 总览使用独立的保留键；同名 slug 可以存在于不同分区。
export const OVERVIEW_GALLERY='__overview';
export const overviewWorkKey=work=>`${work.category}/${work.slug}`;
export function removeGalleryItem(layout,key){
  if(!layout)return null;
  const next=structuredClone(layout);delete next.cards[key];
  if(next.rows)next.rows=next.rows.map(row=>({...row,slugs:row.slugs.filter(item=>item!==key)})).filter(row=>row.slugs.length);
  return Object.keys(next.cards).length?next:null;
}
export function remapGalleryItems(layout,changes){
  if(!layout)return null;
  const next=structuredClone(layout);
  next.cards=Object.fromEntries(Object.entries(next.cards).map(([key,size])=>[changes.get(key)||key,size]));
  if(next.rows)next.rows=next.rows.map(row=>({...row,slugs:row.slugs.map(key=>changes.get(key)||key)}));
  return next;
}
