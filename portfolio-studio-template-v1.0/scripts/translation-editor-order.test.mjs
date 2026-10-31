import {test} from 'node:test';
import assert from 'node:assert/strict';
import {orderedTranslationSources} from '../src/lib/translation-editor-order.js';
test('译文按当前帖子的画面顺序排列，不混入其他帖子或重复说明',()=>{
 const items=[{source:'后面的正文',top:300,left:20},{source:'标题',top:10,left:20},{source:'右图说明',top:200,left:300},{source:'左图说明',top:200,left:20},{source:'标题',top:20,left:20},{source:'系统按钮',top:0,left:0}];
 assert.deepEqual(orderedTranslationSources(items,['其他帖子','后面的正文','标题','左图说明','右图说明']),['标题','左图说明','右图说明','后面的正文']);
 assert.deepEqual(orderedTranslationSources([],['其他帖子']),[]);
});
