import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getAboutTextBlocks,validateAboutTextBlocks,flowAboutText} from '../src/lib/about-text.js';
const legacy={width:512,height:601,copyWidth:627,fontSize:18,content:{title:'我的标题',subtitle:'自由创作',paragraphs:['第一段','第二段']},positions:{desktop:{copy:{x:-61,y:14}},mobile:{copy:{x:0,y:0}}}};
test('手机长译文、标题换行和头像变高后，后续框顺序不变且保留间距',()=>{
  const source=[{id:'bio',y:160,height:400},{id:'title',y:100,height:60},{id:'contact',y:220,height:30}];
  const result=flowAboutText(source,140);
  assert.deepEqual(result.map(b=>[b.id,b.y]),[['title',164],['bio',248],['contact',672]]);
  assert.equal(source[0].y,160);
  assert.equal(flowAboutText([{y:900,height:30}],100)[0].y,900);
});
test('旧简介保留全部文字并迁移成各自独立的文本框',()=>{
  const blocks=getAboutTextBlocks(legacy);assert.equal(blocks.length,4);
  assert.equal(blocks[2].text,'第一段\n\n第二段');assert.equal(blocks[3].href,'mailto:hello@example.com');
  assert.equal(blocks[0].desktop.x,531);assert.equal(blocks[0].desktop.y,69);
  assert.ok(blocks[0].desktop.height<100);assert.ok(blocks[1].desktop.y>blocks[0].desktop.y+blocks[0].desktop.height);
  blocks[0].mobile.x=123;assert.equal(blocks[0].desktop.x,531);
  assert.deepEqual(validateAboutTextBlocks(blocks),getAboutTextBlocks({textBlocks:blocks}));
});
test('可清空所有文本框，拒绝重复标识、危险链接和非法坐标',()=>{
  assert.deepEqual(getAboutTextBlocks({textBlocks:[]}),[]);
  const blocks=getAboutTextBlocks(legacy);assert.throws(()=>validateAboutTextBlocks([blocks[0],blocks[0]]));
  assert.throws(()=>validateAboutTextBlocks([{...blocks[0],href:'javascript:alert(1)'}]));
  assert.throws(()=>validateAboutTextBlocks([{...blocks[0],desktop:{...blocks[0].desktop,x:NaN}}]));
  assert.throws(()=>validateAboutTextBlocks([{...blocks[0],text:'字'.repeat(16001)}]));
});
