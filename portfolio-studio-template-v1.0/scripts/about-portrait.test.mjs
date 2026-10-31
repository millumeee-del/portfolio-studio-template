import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_ABOUT_PORTRAIT,validPortraitPoints,validateAboutPortrait} from '../src/lib/about-portrait.js';
test('替换头像可随排版往返保存，旧头像兼容且拒绝非图片地址',()=>{
  const source={...DEFAULT_ABOUT_PORTRAIT,imageSrc:'/works/uploads/avatar.webp'};
  const saved=validateAboutPortrait(JSON.parse(JSON.stringify(validateAboutPortrait(source))));
  assert.equal(saved.imageSrc,source.imageSrc);assert.deepEqual(saved.points,source.points);
  assert.equal(validateAboutPortrait(DEFAULT_ABOUT_PORTRAIT).imageSrc,undefined);
  for(const imageSrc of ['https://example.com/a.jpg','/works/uploads/../private.png','/works/uploads/video.mp4'])assert.throws(()=>validateAboutPortrait({...source,imageSrc}));
});
test('头像四边形允许斜框，拒绝交叉、翻面和过窄形状',()=>{
  assert.equal(validPortraitPoints(DEFAULT_ABOUT_PORTRAIT.points),true);
  assert.equal(validPortraitPoints([[0,0],[100,0],[100,100],[0,100]]),true);
  assert.equal(validPortraitPoints([[0,0],[100,100],[100,0],[0,100]]),false);
  assert.equal(validPortraitPoints([[0,0],[0,100],[100,100],[100,0]]),false);
  assert.equal(validPortraitPoints([[49,0],[51,0],[51,100],[49,100]]),false);
  assert.throws(()=>validateAboutPortrait({...DEFAULT_ABOUT_PORTRAIT,zoom:100}));
  assert.throws(()=>validateAboutPortrait({...DEFAULT_ABOUT_PORTRAIT,width:NaN}));
  assert.throws(()=>validateAboutPortrait({...DEFAULT_ABOUT_PORTRAIT,fontSize:1000}));
  assert.throws(()=>validateAboutPortrait({...DEFAULT_ABOUT_PORTRAIT,copyWidth:0}));
  assert.equal(validateAboutPortrait({...DEFAULT_ABOUT_PORTRAIT,fontSize:24,copyWidth:600}).fontSize,24);
  const layout=validateAboutPortrait(DEFAULT_ABOUT_PORTRAIT);layout.positions.desktop.copy.x=Infinity;assert.throws(()=>validateAboutPortrait(layout));
  const source=structuredClone(DEFAULT_ABOUT_PORTRAIT),result=validateAboutPortrait(source);result.points[0][0]=30;assert.equal(source.points[0][0],2);
});
test('简介内容随排版保存，兼容旧排版并限制异常输入',()=>{
  const content={title:'ABOUT',subtitle:'关于我',paragraphs:['动画与设计。','<script>只是文字</script>']};
  const saved=validateAboutPortrait({...DEFAULT_ABOUT_PORTRAIT,content});
  assert.deepEqual(saved.content,content);
  saved.content.paragraphs.push('新段落');assert.equal(content.paragraphs.length,2);
  assert.equal(validateAboutPortrait(DEFAULT_ABOUT_PORTRAIT).content,undefined);
  assert.throws(()=>validateAboutPortrait({...DEFAULT_ABOUT_PORTRAIT,content:{...content,paragraphs:['字'.repeat(4001)]}}));
  assert.throws(()=>validateAboutPortrait({...DEFAULT_ABOUT_PORTRAIT,content:{...content,subtitle:12}}));
});
