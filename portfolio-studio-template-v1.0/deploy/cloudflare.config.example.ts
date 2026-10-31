// Example only: copy/adapt inside a configured Cloudflare build project.
// This file contains no account ID, resource ID, token or private origin.
import {bindings,defineConfig} from 'cf/config';
export default defineConfig({worker:{
  name:'portfolio-studio',
  compatibilityDate:'2026-10-30',
  entrypoint:'./server/moods/worker.js',
  assets:{htmlHandling:'auto-trailing-slash',notFoundHandling:'404-page',runWorkerFirst:['/api/*']},
  env:{MOODS:bindings.d1({name:'portfolio-moods'}),ASSETS:bindings.assets()}
}});
// Build-tool setup must supply dist/ as static assets. This file is not an assets.directory setting.
