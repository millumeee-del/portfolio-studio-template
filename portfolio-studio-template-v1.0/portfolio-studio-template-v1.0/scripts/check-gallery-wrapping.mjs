import assert from 'node:assert/strict';
import {resizeGalleryRow,moveGalleryToNextRow,calculateManualGallery,validateGalleryLayout} from '../src/lib/gallery-layout.js';
const ids=['a','b','c','d','e'],make=()=>({cards:Object.fromEntries(ids.map(id=>[id,{span:.2,height:260}])),rows:[{slugs:[...ids],span:1}]}),width=1600,gap=16;
function check(layout){
  validateGalleryLayout(layout,ids);const order=layout.rows.flatMap(row=>row.slugs);assert.equal(new Set(order).size,ids.length);assert.equal(order.length,ids.length);
  const result=calculateManualGallery(order.map(id=>layout.cards[id]),width,gap,layout.rows.map(row=>({count:row.slugs.length,span:row.span})));
  result.cards.forEach((box,index)=>{if(index<result.cards.length-1)assert.ok(box.width/box.height>=.5-1e-5,JSON.stringify(box));assert.ok(box.width>0&&box.x+box.width<=width+.01);});return {order,boxes:result.cards};
}
const atBoundary=resizeGalleryRow(make(),'a',1016,260,width,gap);assert.equal(atBoundary.rows[0].slugs.length,5);check(atBoundary);
const justBelow=resizeGalleryRow(make(),'a',1016.1,260,width,gap);assert.equal(justBelow.rows[0].slugs.length,4);assert.deepEqual(justBelow.rows[1].slugs,['e']);check(justBelow);
const four=resizeGalleryRow(make(),'a',1100,260,width,gap);assert.equal(four.rows[0].slugs.length,4);check(four);
const three=resizeGalleryRow(four,'a',1300,260,width,gap);assert.equal(three.rows[0].slugs.length,3);check(three);
const reversed=resizeGalleryRow(four,'a',980,260,width,gap);assert.equal(reversed.rows[0].slugs.length,4);check(reversed);
const small=resizeGalleryRow(make(),'a',129,260,width,gap);assert.equal(small.rows[0].slugs.length,4);assert.ok(small.rows[1].slugs.includes('a'));check(small);
const tall=resizeGalleryRow(make(),'a',309.6,700,width,gap);assert.ok(tall.rows[1].slugs.includes('a'));check(tall);
const manual=moveGalleryToNextRow(make(),'e',width,gap);assert.deepEqual(manual.rows.map(row=>row.slugs.length),[4,1]);const measured=check(manual);assert.ok(measured.boxes[4].width<400);const again=moveGalleryToNextRow(manual,'d',width,gap);assert.deepEqual(again.rows.map(row=>row.slugs.length),[3,2]);check(again);
for(let i=0,state=make();i<120;i++){state=resizeGalleryRow(state,ids[i%5],100+(i*89)%1400,120+(i*71)%1000,width,gap);check(state);}
for(const viewport of [600,1200,2400,4000])for(let i=0,state=make();i<40;i++){
  state=resizeGalleryRow(state,ids[i%5],60+(i*173)%viewport,120+(i*43)%1000,viewport,gap);validateGalleryLayout(state,ids);
  const order=state.rows.flatMap(row=>row.slugs),result=calculateManualGallery(order.map(id=>state.cards[id]),viewport,gap,state.rows.map(row=>({count:row.slugs.length,span:row.span})));
  assert.ok(result.cards.every(box=>box.width>0&&box.x+box.width<=viewport+.001));
}
console.log('Wrapping checks passed: strict 1:2 boundary, five to four to three, direct shrink, taller cards, manual row move, gesture latching input, sparse rows and randomized edits.');
