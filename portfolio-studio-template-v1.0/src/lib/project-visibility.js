import {overviewWorkKey} from './gallery-identity.js';
import {legacyGalleryRows} from './gallery-layout.js';

export const isVisibleInProjects = work => work.hiddenFromProjects !== true;

export function setProjectVisibility(work, hidden) {
  if (typeof hidden !== 'boolean') throw new Error('请选择有效的项目显示状态');
  const next = {...work};
  if (hidden) next.hiddenFromProjects = true;
  else delete next.hiddenFromProjects;
  return next;
}

// 编辑可见卡片后仍保留隐藏作品的尺寸；恢复时放在已编辑行之后。
// 没有编辑总览时，隐藏/恢复完全不改动原有排版。
export function retainHiddenProjectLayout(layout, previous, works) {
  if (!layout || !previous) return layout;
  const hidden = new Set(works.filter(work => !isVisibleInProjects(work)).map(overviewWorkKey));
  const retained = Object.keys(previous.cards).filter(key => hidden.has(key) && !Object.hasOwn(layout.cards, key));
  if (!retained.length) return layout;
  const next = structuredClone(layout), keys = new Set(retained);
  next.rows ??= legacyGalleryRows(next);
  for (const row of previous.rows ?? legacyGalleryRows(previous)) {
    const slugs = row.slugs.filter(key => keys.has(key));
    if (!slugs.length) continue;
    for (const key of slugs) next.cards[key] = structuredClone(previous.cards[key]);
    next.rows.push({slugs, span:Math.min(1, slugs.reduce((sum,key) => sum + previous.cards[key].span, 0))});
  }
  return next;
}
