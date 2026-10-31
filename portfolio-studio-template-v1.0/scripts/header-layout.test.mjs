import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateHomeLayout} from '../src/lib/home-layout.js';
import {validateHeaderLayout,headerLayoutCSS} from '../src/lib/header-layout.js';
import {readFile} from 'node:fs/promises';
const layouts={desktop:{referenceWidth:1100,height:800,character:{x:0,y:0,width:400,height:650},wheel:{x:550,y:200,width:500,height:300,fontSize:30,pointerSize:8,pointerOffset:-20}}};
const header={referenceWidth:1280,items:{nav:{x:0,anchor:'center',y:30,scale:1.2,fontSize:24,gap:54},language:{x:22,anchor:'right',y:22,scale:1,fontSize:12,gap:0}}};
test('顶部排版与首页一起保存，兼容旧排版并保留电脑手机独立设置',()=>{
 const old=validateHomeLayout({...layouts.desktop,header:undefined});assert.equal(old.header,undefined);
 assert.deepEqual(validateHomeLayout({...layouts.desktop,header}).header,header);
 const css=headerLayoutCSS({desktop:{header},mobile:{header:{...header,referenceWidth:390}}});
 assert.match(css,/@media\(min-width:701px\)/);assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/left:calc\(50vw \+ 0px\)/);assert.match(css,/right:clamp\(0px,22px,/);assert.match(css,/font-size:24px/);assert.match(css,/gap:54px/);
});
test('初版视口坐标升级后导航居中，按钮保持右边距，窗口缩小时不跑出屏幕',()=>{
 const legacy={referenceWidth:2560,items:{nav:{x:1110.641,y:30,scale:1,fontSize:24,gap:54},language:{x:2460,y:22,scale:1,fontSize:12,gap:0}}};
 const result=validateHeaderLayout(legacy);assert.ok(Math.abs(result.items.nav.x)<.001);assert.equal(result.items.language.x,22);
 assert.deepEqual(validateHeaderLayout(result),result);
});
test('顶部排版拒绝越界尺寸和注入内容',()=>{
 assert.throws(()=>validateHeaderLayout({...header,items:{nav:{...header.items.nav,scale:20}}}));
 assert.throws(()=>validateHeaderLayout({...header,items:{nav:{...header.items.nav,x:'0; color:red'}}}));
 assert.equal(headerLayoutCSS({desktop:{header:{...header,items:{unknown:header.items.nav}}}}),'@media(min-width:701px){}');
});

