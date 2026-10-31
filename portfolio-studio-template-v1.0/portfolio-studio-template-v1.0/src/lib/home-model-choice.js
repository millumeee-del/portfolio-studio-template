// 同时用于 HTML 顶部的轻量初始化和 3D 脚本，避免静态预览与模型选成两次。
// 保持自包含：Astro 会把此函数序列化进首页，在 Three.js 加载前执行。
export function selectHomeModel(models, storage, pageId) {
  const key = 'studio-debug-model';
  let index = 0;
  try {
    const savedIndex = models.findIndex(model => model.id === storage.getItem(key));
    index = Math.max(0, savedIndex);
    if (savedIndex >= 0 && storage.getItem(`${key}-page`) !== pageId) index = (index + 1) % models.length;
    storage.setItem(key, models[index].id);
    storage.setItem(`${key}-page`, pageId);
  } catch {}
  return index;
}
