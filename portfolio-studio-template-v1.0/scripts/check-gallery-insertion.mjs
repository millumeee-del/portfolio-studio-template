import assert from 'node:assert/strict';
import {insertGalleryIntoRow,validateGalleryLayout,calculateManualGallery} from '../src/lib/gallery-layout.js';
const ids=['a','b','c','d','e','f'],initial={cards:Object.fromEntries(ids.map((id,i)=>[id,{span:i<4?.25:.2,height:260}])),rows:[{slugs:ids.slice(0,4),span:1},{slugs:ids.slice(4),span:.4}]};
const options=[1400,16];
function check(layout,keys=ids){
  validateGalleryLayout(layout,keys);const order=layout.rows.flatMap(row=>row.slugs);assert.equal(order.length,keys.length);assert.equal(new Set(order).size,keys.length);
  const result=calculateManualGallery(order.map(id=>layout.cards[id]),...options,layout.rows.map(row=>({count:row.slugs.length,span:row.span})));
  assert.ok(result.cards.every(box=>box.width>0&&box.x+box.width<=1400+.001&&box.width/box.height>=.5-1e-5));
}
const three=insertGalleryIntoRow(initial,'a',1,null,...options);assert.deepEqual(three.rows.map(row=>row.slugs.length),[3,3]);assert.deepEqual(three.rows[1].slugs,['e','f','a']);check(three);
const four=insertGalleryIntoRow(three,'b',1,'f',...options);assert.deepEqual(four.rows.map(row=>row.slugs.length),[2,4]);assert.deepEqual(four.rows[1].slugs,['e','b','f','a']);check(four);
const up=insertGalleryIntoRow(four,'b',0,null,...options);assert.deepEqual(up.rows.map(row=>row.slugs.length),[3,3]);assert.deepEqual(up.rows[0].slugs,['c','d','b']);check(up);
const sorted=insertGalleryIntoRow(initial,'a',0,'c',...options);assert.deepEqual(sorted.rows[0].slugs,['b','a','c','d']);check(sorted);
assert.deepEqual(insertGalleryIntoRow(initial,'a',0,'b',...options),initial);assert.deepEqual(insertGalleryIntoRow(initial,'a',0,'a',...options),initial);assert.deepEqual(initial.rows.map(row=>row.slugs.length),[4,2]);
const singleton={cards:{a:{span:.5,height:260},b:{span:.5,height:260}},rows:[{slugs:['a'],span:.5},{slugs:['b'],span:.5}]};
const removed=insertGalleryIntoRow(singleton,'a',1,null,...options);assert.equal(removed.rows.length,1);check(removed,['a','b']);
const tall=structuredClone(initial);tall.cards.a.height=900;const tallInserted=insertGalleryIntoRow(tall,'a',1,null,...options);assert.ok(tallInserted.rows[1].slugs.includes('a'));check(tallInserted);
for(let i=0,state=initial;i<100;i++){state=insertGalleryIntoRow(state,ids[i%ids.length],i%state.rows.length,null,...options);check(state);}
console.log('Insertion checks passed: two to three to four, insertion order, upward moves, same-row sorting, no-op drops, empty row removal and tall cards.');
