import {legacyGalleryRows} from './gallery-layout.js';
import {OVERVIEW_GALLERY,remapGalleryItems} from './gallery-identity.js';
const label = value => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 80) throw new Error('分区名称需为 1–80 个字符');
  return value.trim();
};
export function createCategory(value, categories) {
  const name = label(value);
  if (categories.some(category => category.label.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new Error('已存在同名分区');
  const base = name.normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,64).replace(/-$/g,'') || 'category';
  let slug = base, number = 2;
  while (categories.some(category => category.slug === slug)) slug = `${base}-${number++}`;
  return {number:String(categories.length+1).padStart(2,'0'),slug,label:name};
}
export function renameCategory(value, slug, categories) {
  const name = label(value);
  if (categories.some(category => category.slug !== slug && category.label.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new Error('已存在同名分区');
  return categories.map(category => category.slug === slug ? {...category,label:name} : category);
}
export function reorderCategories(order, categories) {
  const bySlug = new Map(categories.map(category => [category.slug, category]));
  if (!Array.isArray(order) || order.length !== categories.length || new Set(order).size !== order.length || order.some(slug => typeof slug !== 'string' || !bySlug.has(slug))) {
    throw new Error('排序需包含全部分区，且不能重复；请重新打开排序后再试');
  }
  return order.map((slug, index) => ({...bySlug.get(slug), number: String(index + 1).padStart(2, '0')}));
}
export function migrateCategory(source, destination, works, layouts) {
  const occupied = new Set(works.filter(work => work.category === destination).map(work => work.slug));
  const moves = [];
  const nextWorks = works.map(work => {
    if (work.category !== source) return work;
    let slug = work.slug, suffix = 2;
    while (occupied.has(slug)) slug = `${work.slug}-${suffix++}`;
    occupied.add(slug); moves.push({from:work.slug,to:slug});
    return {...work,category:destination,slug};
  });
  const nextLayouts = structuredClone(layouts);
  if(nextLayouts[OVERVIEW_GALLERY])nextLayouts[OVERVIEW_GALLERY]=remapGalleryItems(nextLayouts[OVERVIEW_GALLERY],new Map(moves.map(move=>[`${source}/${move.from}`,`${destination}/${move.to}`])));
  const sourceLayout=layouts[source],destinationLayout=layouts[destination];
  const destinationRows=destinationLayout?(destinationLayout.rows||legacyGalleryRows(destinationLayout)):[];
  for (const move of moves) {
    const size = layouts[source]?.cards?.[move.from];
    if (size) {
      nextLayouts[destination] ??= {cards:{}};
      nextLayouts[destination].cards[move.to] = size;
    }
  }
  if(nextLayouts[destination]&&(sourceLayout?.rows||destinationLayout?.rows)){
    const moved=new Map(moves.map(move=>[move.from,move.to]));
    const sourceRows=sourceLayout?(sourceLayout.rows||legacyGalleryRows(sourceLayout)):[];
    nextLayouts[destination].rows=[...structuredClone(destinationRows),...sourceRows.map(row=>({...row,slugs:row.slugs.filter(slug=>moved.has(slug)).map(slug=>moved.get(slug))})).filter(row=>row.slugs.length)];
  }
  delete nextLayouts[source];
  return {works:nextWorks,layouts:nextLayouts,moves};
}
