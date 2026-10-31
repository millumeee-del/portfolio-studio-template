import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { CHARACTER_MODELS } from '../data/character-models.js';
import {sharedCharacterAnimation} from './character-animation.server.js';

const sourceRoot = fileURLToPath(new URL('../../', import.meta.url));
// Astro 构建时会搬移服务端模块；构建进程的工作目录仍是工程根目录。
const root = existsSync(path.join(sourceRoot, 'src/data/character-models.js')) ? sourceRoot : process.cwd();
const read = file => { try { return readFileSync(path.join(root, file)); } catch { return Buffer.from(`missing:${file}`); } };

// 每次生成首页都检查实际文件，替换同名 GLB 后不必手动改 ?v=。
export function resolveCharacterAssets() {
  const animation={revision:'embedded-demo',url:''};
  let previews = {};
  try { previews = JSON.parse(read('src/data/character-previews.json')); } catch {}
  const renderer = ['character-interaction.js', 'character-face.js', 'character-cable.js', 'character-motion.js', 'character-gaze.js'].map(file => read(`src/scripts/${file}`));
  return CHARACTER_MODELS.map(model => {
    const hash = createHash('sha256');
    hash.update(read(`public${model.src.split('?')[0]}`));
    hash.update(animation.revision);hash.update(read('src/scripts/character-animation.js'));
    hash.update(JSON.stringify([model.animationName, model.faceDirectory, model.faceTexturePrefix, model.faceTextures]));
    renderer.forEach(bytes => hash.update(bytes));
    if (model.faceDirectory && model.faceDirectory !== 'none') {
      const prefix = model.faceTexturePrefix || 'face';
      hash.update(read(`public${model.faceDirectory}/face-overlay.json`));
      for (const file of model.faceTextures || [`${model.faceDirectory}/${prefix}_01.png`, `${model.faceDirectory}/${prefix}_02.png`]) hash.update(read(`public${file}`));
    }
    const revision = hash.digest('hex').slice(0, 16);
    const preview = previews[model.id];
    const poster = model.poster?.split('?')[0];
    const valid = preview?.revision === revision && /^\/models\/previews\/[a-z0-9-]+\.png$/.test(poster) && existsSync(path.join(root, `public${poster}`));
    const posterVersion = valid ? createHash('sha256').update(read(`public${poster}`)).digest('hex').slice(0, 12) : '';
    return {...model, revision, animationUrl:animation.url, src: `${model.src.split('?')[0]}?v=${revision}`, poster: valid ? `${poster}?v=${revision}-${posterVersion}` : null, posterFraming: valid ? preview.framing || null : null};
  });
}
