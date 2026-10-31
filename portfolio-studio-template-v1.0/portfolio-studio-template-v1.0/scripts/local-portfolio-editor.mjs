import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {validateWorkDraft} from '../src/lib/work-content.js';
import {validateGalleryLayout} from '../src/lib/gallery-layout.js';
import {validateHomeLayout} from '../src/lib/home-layout.js';
import {OVERVIEW_GALLERY,overviewWorkKey,removeGalleryItem} from '../src/lib/gallery-identity.js';
import {createProject} from '../src/lib/project-management.js';
import {isVisibleInProjects,setProjectVisibility,retainHiddenProjectLayout} from '../src/lib/project-visibility.js';
import {createCategory,renameCategory,reorderCategories,migrateCategory} from '../src/lib/category-management.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const dataFile=path.join(root,'src/data/works.json');
const galleryFile=path.join(root,'src/data/gallery-layouts.json');
const categoryFile=path.join(root,'src/data/categories.json');
const homeLayoutFile=path.join(root,'src/data/home-layouts.json');
const aboutPortraitFile=path.join(root,'src/data/about-portrait.json');
const version=work=>createHash('sha256').update(JSON.stringify(work)).digest('hex');
const failure=(message,status=400)=>Object.assign(new Error(message),{status});
async function atomicJson(file, value) {
  const temporary=`${file}.${randomUUID()}.tmp`;
  await writeFile(temporary,JSON.stringify(value,null,2)+'\n');
  await rename(temporary,file);
}
async function readBody(req,limit){
  if(Number(req.headers['content-length'])>limit)throw failure('文件太大，单个素材最多 200 MB',413);
  let size=0;const chunks=[];
  for await(const chunk of req){size+=chunk.length;if(size>limit)throw failure('请求内容太大',413);chunks.push(chunk);}
  return Buffer.concat(chunks);
}
export default function localPortfolioEditor(){
  let saveQueue=Promise.resolve();
  return {
    name:'studio-local-work-editor',apply:'serve',
    configureServer(server){
      server.middlewares.use(async(req,res,next)=>{
        const url=new URL(req.url || '/', 'http://localhost');
        // 自动刷新可能请求刚删除的分区；先完成用户已指定的站内跳转。
        if(req.method==='GET'&&req.headers.accept?.includes('text/html')){
          try {
            const cookie=req.headers.cookie?.split(';').map(item=>item.trim()).find(item=>item.startsWith('studio-navigation='));
            const destination=cookie ? decodeURIComponent(cookie.slice('studio-navigation='.length)) : '';
            if(/^(?:\/edit\/[a-z0-9-]+\/[a-z0-9-]+\/|\/projects\/(?:[a-z0-9-]+\/)?)$/.test(destination)&&url.pathname!==destination){
              res.statusCode=302;res.setHeader('Location',destination);res.setHeader('Cache-Control','no-store');return res.end();
            }
          }catch{}
        }
        if(!url.pathname.startsWith('/__portfolio-editor/'))return next();
        const reply=(status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(data));};
        try {
          // Only the local browser origin may access the writing endpoints.
          const host=req.headers.host || '';
          if(!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host))throw failure('编辑器仅供本机使用',403);
          if(req.headers.origin&&req.headers.origin!==`http://${host}`&&req.headers.origin!==`https://${host}`)throw failure('请求来源不匹配',403);
          if(req.method==='POST'&&!req.headers.origin)throw failure('缺少本地请求来源',403);
          if(url.pathname==='/__portfolio-editor/home-layout'){
            const response=(store,profile)=>({layouts:store,profile,layout:store[profile]??null,version:version(store[profile]??null)});
            if(req.method==='GET'){
              const profile=url.searchParams.get('profile');
              if(!['desktop','mobile'].includes(profile))throw failure('请选择电脑或手机排版');
              return reply(200,response(JSON.parse(await readFile(homeLayoutFile,'utf8')),profile));
            }
            if(req.method==='POST'){
              if(!req.headers['content-type']?.startsWith('application/json'))throw failure('请提交 JSON 数据');
              const payload=JSON.parse((await readBody(req,64*1024)).toString('utf8'));
              if(!['desktop','mobile'].includes(payload.profile))throw failure('请选择电脑或手机排版');
              const operation=saveQueue.then(async()=>{
                const before=JSON.parse(await readFile(homeLayoutFile,'utf8'));
                if(payload.version!==version(before[payload.profile]??null))throw failure('这套排版已在其他窗口修改。请退出编辑后重新打开；当前草稿尚未覆盖原文件。',409);
                const layout=validateHomeLayout(payload.layout);
                const backups=path.join(root,'.codex-backups/home-layout');await mkdir(backups,{recursive:true});
                await writeFile(path.join(backups,Date.now()+'-'+randomUUID().slice(0,8)+'.json'),JSON.stringify(before,null,2)+'\n');
                const next={...before,[payload.profile]:layout};await atomicJson(homeLayoutFile,next);
                return response(next,payload.profile);
              });
              saveQueue=operation.catch(()=>{});return reply(200,await operation);
            }
            throw failure('不支持的请求方式',405);
          }
          if(url.pathname==='/__portfolio-editor/about-portrait'){
            const response=layout=>({layout,version:version(layout)});
            if(req.method==='GET')return reply(200,response(JSON.parse(await readFile(aboutPortraitFile,'utf8'))));
            if(req.method==='POST'){
              if(!req.headers['content-type']?.startsWith('application/json'))throw failure('请提交 JSON 数据');
              const payload=JSON.parse((await readBody(req,128*1024)).toString('utf8'));
              const operation=saveQueue.then(async()=>{
                const before=JSON.parse(await readFile(aboutPortraitFile,'utf8'));
                if(payload.version!==version(before))throw failure('头像框已在其他窗口修改，请退出后重新编辑；当前草稿没有覆盖原文件。',409);
                const {validateAboutPortrait}=await server.ssrLoadModule('/src/lib/about-portrait.js');
                const layout=validateAboutPortrait(payload.layout),backups=path.join(root,'.codex-backups/about-portrait');
                await mkdir(backups,{recursive:true});await writeFile(path.join(backups,Date.now()+'-'+randomUUID().slice(0,8)+'.json'),JSON.stringify(before,null,2)+'\n');
                await atomicJson(aboutPortraitFile,layout);return response(layout);
              });
              saveQueue=operation.catch(()=>{});return reply(200,await operation);
            }
            throw failure('不支持的请求方式',405);
          }
          const categories=JSON.parse(await readFile(categoryFile,'utf8'));
          if(url.pathname==='/__portfolio-editor/categories'&&req.method==='GET'){
            const works=JSON.parse(await readFile(dataFile,'utf8'));
            return reply(200,{categories,version:version(categories),counts:Object.fromEntries(categories.map(category=>[category.slug,works.filter(work=>work.category===category.slug).length]))});
          }
          if(url.pathname==='/__portfolio-editor/categories'&&req.method==='POST'){
            if(!req.headers['content-type']?.startsWith('application/json'))throw failure('请提交 JSON 数据');
            const payload=JSON.parse((await readBody(req,64*1024)).toString('utf8'));
            const operation=saveQueue.then(async()=>{
              const before=JSON.parse(await readFile(categoryFile,'utf8'));
              if(payload.version!==version(before))throw failure('分区列表已在其他窗口更新，请重新打开后再编辑。',409);
              let next=structuredClone(before),created=null,migration=null;
              const works=JSON.parse(await readFile(dataFile,'utf8')),layouts=JSON.parse(await readFile(galleryFile,'utf8'));
              if(payload.action==='create') {created=createCategory(payload.label,before);next.push(created);}
              else if(payload.action==='reorder') next=reorderCategories(payload.order,before);
              else {
                if(!before.some(category=>category.slug===payload.slug))throw failure('该分区已不存在',404);
                if(payload.action==='rename')next=renameCategory(payload.label,payload.slug,before);
                else if(payload.action==='delete'){
                  if(before.length<=1)throw failure('至少保留一个分区');
                  const populated=works.some(work=>work.category===payload.slug);
                  const destination=before.find(category=>category.slug===payload.destination&&category.slug!==payload.slug);
                  if(populated&&!destination)throw failure('请选择接收作品的分区');
                  next=before.filter(category=>category.slug!==payload.slug);
                  migration=migrateCategory(payload.slug,destination?.slug,works,layouts);
                }else throw failure('不支持的分区操作');
              }
              next=next.map((category,index)=>({...category,number:String(index+1).padStart(2,'0')}));
              const backups=path.join(root,'.codex-backups/category-manager');await mkdir(backups,{recursive:true});
              await writeFile(path.join(backups,`${Date.now()}-${randomUUID().slice(0,8)}.json`),JSON.stringify({categories:before,works,layouts},null,2)+'\n');
              // 先写迁移数据，最后更新路由分区；失败时恢复已写入的文件。
              try {
                if(migration){await atomicJson(dataFile,migration.works);await atomicJson(galleryFile,migration.layouts);}
                await atomicJson(categoryFile,next);
              }catch(error){
                if(migration){await atomicJson(dataFile,works);await atomicJson(galleryFile,layouts);}
                throw error;
              }
              return {categories:next,version:version(next),created,moves:migration?.moves ?? []};
            });
            saveQueue=operation.catch(()=>{});return reply(200,await operation);
          }
          if(url.pathname==='/__portfolio-editor/projects'&&req.method==='GET'){
            const works=JSON.parse(await readFile(dataFile,'utf8'));
            return reply(200,{hidden:works.filter(work=>!isVisibleInProjects(work)).map(work=>({category:work.category,slug:work.slug,title:work.title,version:version(work)}))});
          }
          if(url.pathname==='/__portfolio-editor/projects'&&req.method==='POST'){
            if(!req.headers['content-type']?.startsWith('application/json'))throw failure('请提交 JSON 数据');
            const payload=JSON.parse((await readBody(req,64*1024)).toString('utf8'));
            const operation=saveQueue.then(async()=>{
              const previous=await readFile(dataFile,'utf8'),works=JSON.parse(previous);
              const backups=path.join(root,'.codex-backups/project-manager');
              const stamp=`${Date.now()}-${randomUUID().slice(0,8)}`;
              if(payload.action==='create'){
                const work=createProject(payload,works,JSON.parse(await readFile(categoryFile,'utf8')));
                await mkdir(backups,{recursive:true});await writeFile(path.join(backups,`${stamp}-works.json`),previous);
                await atomicJson(dataFile,[...works,work]);
                return {work,version:version(work)};
              }
              if(payload.action==='visibility'){
                const index=works.findIndex(work=>work.category===payload.category&&work.slug===payload.slug);
                if(index<0)throw failure('该作品已被删除或不存在',404);
                if(payload.version!==version(works[index]))throw failure('作品已在其他窗口修改，请刷新后重试。',409);
                const work=setProjectVisibility(works[index],payload.hidden);
                await mkdir(backups,{recursive:true});await writeFile(path.join(backups,`${stamp}-works.json`),previous);
                works[index]=work;await atomicJson(dataFile,works);
                return {work,version:version(work)};
              }
              if(payload.action==='delete'){
                const index=works.findIndex(work=>work.category===payload.category&&work.slug===payload.slug);
                if(index<0)throw failure('该作品已被删除或不存在',404);
                if(payload.version!==version(works[index]))throw failure('作品已在其他窗口修改，请重新打开删除窗口后确认。',409);
                const originalLayoutText=await readFile(galleryFile,'utf8'),store=JSON.parse(originalLayoutText);
                const previousGalleryVersion=version(store[payload.category] ?? null);
                const previousOverviewGalleryVersion=version(store[OVERVIEW_GALLERY] ?? null);
                for(const [scope,key] of [[payload.category,payload.slug],[OVERVIEW_GALLERY,overviewWorkKey(works[index])]]){const next=removeGalleryItem(store[scope],key);if(next)store[scope]=next;else delete store[scope];}
                await mkdir(backups,{recursive:true});
                await writeFile(path.join(backups,`${stamp}-works.json`),previous);
                await writeFile(path.join(backups,`${stamp}-layouts.json`),originalLayoutText);
                await atomicJson(galleryFile,store);
                try { await atomicJson(dataFile,works.filter((_,i)=>i!==index)); }
                catch(error) { await atomicJson(galleryFile,JSON.parse(originalLayoutText)); throw error; }
                return {deleted:true,previousGalleryVersion,galleryVersion:version(store[payload.category] ?? null),previousOverviewGalleryVersion,overviewGalleryVersion:version(store[OVERVIEW_GALLERY] ?? null)};
              }
              throw failure('不支持的项目操作');
            });
            saveQueue=operation.catch(()=>{});
            return reply(200,await operation);
          }
          if(url.pathname==='/__portfolio-editor/gallery'&&req.method==='GET'){
            const category=url.searchParams.get('category');
            const works=JSON.parse(await readFile(dataFile,'utf8'));
            if(category!==OVERVIEW_GALLERY&&!categories.some(item=>item.slug===category))throw failure('找不到该分区',404);
            const store=JSON.parse(await readFile(galleryFile,'utf8'));
            const layout=store[category] ?? null;
            return reply(200,{layout,version:version(layout)});
          }
          if(url.pathname==='/__portfolio-editor/gallery'&&req.method==='POST'){
            if(!req.headers['content-type']?.startsWith('application/json'))throw failure('请提交 JSON 数据');
            const payload=JSON.parse((await readBody(req,256*1024)).toString('utf8'));
            const operation=saveQueue.then(async()=>{
              const works=JSON.parse(await readFile(dataFile,'utf8'));
              const slugs=payload.category===OVERVIEW_GALLERY?works.map(overviewWorkKey):works.filter(work=>work.category===payload.category).map(work=>work.slug);
              if(payload.category!==OVERVIEW_GALLERY&&!JSON.parse(await readFile(categoryFile,'utf8')).some(item=>item.slug===payload.category))throw failure('找不到该分区',404);
              const previous=await readFile(galleryFile,'utf8'),store=JSON.parse(previous);
              if(payload.version!==version(store[payload.category] ?? null))throw failure('排版已在其他窗口改动，请刷新后重新调整。当前草稿仍保留在浏览器中。',409);
              let layout=validateGalleryLayout(payload.layout,slugs);
              if(payload.category===OVERVIEW_GALLERY)layout=validateGalleryLayout(retainHiddenProjectLayout(layout,store[payload.category],works),slugs);
              if(layout)store[payload.category]=layout;else delete store[payload.category];
              const backups=path.join(root,'.codex-backups/gallery-editor');await mkdir(backups,{recursive:true});
              await writeFile(path.join(backups,`${Date.now()}-${randomUUID().slice(0,8)}.json`),previous);
              const temporary=`${galleryFile}.${randomUUID()}.tmp`;
              await writeFile(temporary,JSON.stringify(store,null,2)+'\n');await rename(temporary,galleryFile);
              return {layout,version:version(layout)};
            });
            saveQueue=operation.catch(()=>{});
            return reply(200,await operation);
          }
          if(url.pathname==='/__portfolio-editor/work'&&req.method==='GET'){
            const works=JSON.parse(await readFile(dataFile,'utf8'));
            const work=works.find(item=>item.category===url.searchParams.get('category')&&item.slug===url.searchParams.get('slug'));
            if(!work)throw failure('找不到该作品',404);
            return reply(200,{work,version:version(work)});
          }
          if(url.pathname==='/__portfolio-editor/work'&&req.method==='POST'){
            if(!req.headers['content-type']?.startsWith('application/json'))throw failure('请提交 JSON 数据');
            const payload=JSON.parse((await readBody(req,2*1024*1024)).toString('utf8'));
            const draft=validateWorkDraft(payload.draft);
            const operation=saveQueue.then(async()=>{
              const previous=await readFile(dataFile,'utf8'),works=JSON.parse(previous);
              const index=works.findIndex(item=>item.category===payload.category&&item.slug===payload.slug);
              if(index<0)throw failure('找不到该作品',404);
              if(payload.version!==version(works[index]))throw failure('作品已在其他窗口或文件中改动。请先复制当前文字，再刷新编辑器后保存。',409);
              works[index]={...works[index],...draft};
              const backups=path.join(root,'.codex-backups/work-editor');await mkdir(backups,{recursive:true});
              await writeFile(path.join(backups,`${Date.now()}-${randomUUID().slice(0,8)}.json`),previous);
              const temporary=`${dataFile}.${randomUUID()}.tmp`;
              await writeFile(temporary,JSON.stringify(works,null,2)+'\n');await rename(temporary,dataFile);
              return {work:works[index],version:version(works[index])};
            });
            saveQueue=operation.catch(()=>{});
            return reply(200,await operation);
          }
          if(url.pathname==='/__portfolio-editor/upload'&&req.method==='POST'){
            const name=decodeURIComponent(String(req.headers['x-file-name'] || ''));
            const ext=path.extname(name).toLowerCase();
            if(!['.gif','.png','.jpg','.jpeg','.webp','.avif','.mp4','.m4v','.webm'].includes(ext))throw failure('支持 GIF、PNG、JPG、WebP、AVIF、MP4、M4V、WebM');
            const content=await readBody(req,200*1024*1024);if(!content.length)throw failure('素材文件为空');
            const destination=path.join(root,'public/works/uploads');await mkdir(destination,{recursive:true});
            const filename=`${Date.now()}-${randomUUID().slice(0,8)}${ext}`;
            await writeFile(path.join(destination,filename),content,{flag:'wx'});
            return reply(200,{src:`/works/uploads/${filename}`,name});
          }
          reply(404,{error:'找不到编辑器接口'});
        }catch(error){reply(error.status || 400,{error:error.message || '保存失败'});}
      });
    }
  };
}
