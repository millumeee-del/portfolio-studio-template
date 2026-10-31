// @ts-check
import { defineConfig } from 'astro/config';
import localPortfolioEditor from './scripts/local-portfolio-editor.mjs';
import localMoods from './scripts/local-moods.mjs';
import localTranslations from './scripts/local-translations.mjs';
import localShowreels from './scripts/local-showreels.mjs';

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [localTranslations(), localShowreels(), localPortfolioEditor(), localMoods()],
    watch: {ignored:['**/.translation-models/**','**/.visitor-data/**','**/.publish-state/**','**/tools/cloudflare-publish/.cloudflare/**','**/tools/cloudflare-publish/.wrangler/**']},
    optimizeDeps: {
      // 首页所需模块一次性预构建，避免切换内页后才发现依赖而生成过期链接。
      include: ['three', 'three/addons/loaders/GLTFLoader.js', 'three/addons/environments/RoomEnvironment.js', 'three/addons/libs/meshopt_decoder.module.js']
    }
  }
});
