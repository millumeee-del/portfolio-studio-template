import path from 'node:path';
import {stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const publicRoot = fileURLToPath(new URL('../../public/', import.meta.url));
const cache = new Map();

// 在输出页面之前读取本地缩略图尺寸，首帧和图片加载后使用同一比例。
export async function coverDimensions(src) {
  if (typeof src !== 'string' || !src.startsWith('/') || src.startsWith('//')) return null;
  try {
    const pathname = decodeURIComponent(new URL(src, 'http://localhost').pathname);
    const file = path.resolve(publicRoot, `.${pathname}`);
    const relative = path.relative(publicRoot, file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
    const info = await stat(file);
    if (!info.isFile()) return null;
    const key = `${info.mtimeMs}:${info.size}`;
    if (cache.get(file)?.key !== key) {
      const value = sharp(file, {pages: 1}).metadata().then(meta => {
        const width = meta.autoOrient?.width ?? meta.width;
        const height = meta.autoOrient?.height ?? meta.pageHeight ?? meta.height;
        return width > 0 && height > 0 ? {width, height} : null;
      }).catch(() => null);
      cache.set(file, {key, value});
    }
    return await cache.get(file).value;
  } catch { return null; }
}
