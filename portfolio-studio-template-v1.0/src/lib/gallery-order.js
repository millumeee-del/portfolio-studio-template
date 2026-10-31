// 行成员决定阅读顺序；未排版的新作品追加，已删除的作品忽略。
// 不依赖 DOM，供画廊首帧脚本、左侧目录和作品翻页共用。
export function orderGalleryKeys(keys, layout) {
  const allowed = new Set(keys), seen = new Set(), ordered = [];
  const requested = Array.isArray(layout?.rows) ? layout.rows.flatMap(row => row.slugs) : [];
  for (const key of [...requested, ...keys]) {
    if (allowed.has(key) && !seen.has(key)) { seen.add(key); ordered.push(key); }
  }
  return ordered;
}
