import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {validateShowreelSettings,validateShowreelWatchLayouts,showreelWatchLayoutCSS} from '../src/lib/showreel-settings.js';
import {createShowreelStore} from './local-showreels.mjs';
const settings={title:'SHOWREEL',titleEn:'REELS',hint:'拖动观看',hintEn:'Drag to explore',cards:[2026,2024,2022].map(year=>({year,label:String(year),description:'中文简介',descriptionEn:'English description'}))};
test('修改显示文字保留视频年份，拒绝缺失年份和非文本输入',()=>{
  const next=structuredClone(settings);next.cards[1].label='2023–2024';
  assert.equal(validateShowreelSettings(next).cards[1].year,2024);
  assert.equal(validateShowreelSettings(next).cards[1].label,'2023–2024');
  assert.throws(()=>validateShowreelSettings({...next,title:42}));
  assert.throws(()=>validateShowreelSettings({...next,cards:next.cards.map(card=>({...card,year:2026}))}));
});
test('文字写入真实 JSON 后可重新读取，过期窗口不能覆盖已保存内容',async t=>{
  const folder=await mkdtemp(join(tmpdir(),'studio-showreel-')),file=join(folder,'settings.json');
  t.after(async()=>{await unlink(file);await rmdir(folder);});
  await writeFile(file,JSON.stringify(settings));const store=createShowreelStore(pathToFileURL(file)),first=await store.read();
  const next=structuredClone(settings);next.hint='这是手动修改后的提示';next.cards[0].descriptionEn='A manually edited description';next.cards[1].thumbnail='/works/uploads/1234-thumbnail.png';next.watchLayouts={desktop:{x:-10,y:42},mobile:{x:0,y:15}};
  const saved=await store.save(next,first.version);
  assert.notEqual(saved.version,first.version);assert.deepEqual((await store.read()).settings,next);
  await assert.rejects(store.save(settings,first.version),error=>error.status===409);
  assert.deepEqual((await store.read()).settings,next);
});

test('年份导航桌面与手机位置独立保存，首屏 CSS 无需等待脚本',()=>{
  const layouts={desktop:{x:-10,y:42},mobile:{x:0,y:15}};
  assert.deepEqual(validateShowreelWatchLayouts(layouts),layouts);
  const css=showreelWatchLayoutCSS(layouts);
  assert.match(css,/@media\(min-width:701px\).*translateY\(42px\).*translateX\(-10vw\)/);
  assert.match(css,/@media\(max-width:700px\).*translateY\(15px\).*translateX\(0vw\)/);
  assert.throws(()=>validateShowreelWatchLayouts({desktop:{x:Infinity,y:20}}));
  assert.throws(()=>validateShowreelWatchLayouts({mobile:{x:0,y:'20px'}}));
});

test('缩略图独立配置，兼容旧设置，拒绝脚本、视频和路径穿越',()=>{
  assert.ok(!('thumbnail' in validateShowreelSettings(settings).cards[0]));
  for(const thumbnail of ['/works/uploads/thumbnail.webp','/showreel/2024-poster.webp']){
    const next=structuredClone(settings);next.cards[0].thumbnail=thumbnail;
    const saved=validateShowreelSettings(next);
    assert.equal(saved.cards[0].thumbnail,thumbnail);assert.ok(!('thumbnail' in saved.cards[1]));
  }
  for(const thumbnail of ['javascript:alert(1)','/showreel/2026.mp4','/works/uploads/../secret.png','https://example.com/a.jpg']){
    const next=structuredClone(settings);next.cards[0].thumbnail=thumbnail;
    assert.throws(()=>validateShowreelSettings(next));
  }
});
