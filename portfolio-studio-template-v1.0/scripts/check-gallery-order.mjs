import assert from 'node:assert/strict';
import {orderGalleryKeys} from '../src/lib/gallery-order.js';
import {galleryBootstrapSource} from '../src/lib/gallery-bootstrap.js';

const keys=['a','b','c','new'];
// cards 的属性顺序来自旧尺寸数据，实际顺序以每行从左到右的成员为准。
const layout={cards:{a:{},b:{},c:{}},rows:[{slugs:['c','a']},{slugs:['b']}]};
assert.deepEqual(orderGalleryKeys(keys,layout),['c','a','b','new']);
assert.deepEqual(orderGalleryKeys(keys,{rows:[{slugs:['deleted','b','b']},{slugs:['a']}]}),['b','a','c','new']);
assert.deepEqual(orderGalleryKeys(keys,null),keys);
assert.deepEqual(orderGalleryKeys(keys,{cards:layout.cards}),keys);
assert.deepEqual(orderGalleryKeys(['cat-a/same','cat-b/same'],{rows:[{slugs:['cat-b/same']}]}),['cat-b/same','cat-a/same']);
assert.deepEqual(keys,['a','b','c','new']);
// 首帧脚本序列化后也必须包含共用排序函数，避免加载后再重新对位。
new Function('document',galleryBootstrapSource())({currentScript:{previousElementSibling:null}});
console.log('Gallery order checks passed: row reading order, new/deleted items, duplicates, automatic reset, composite keys and standalone bootstrap.');
