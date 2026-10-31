import {test} from 'node:test';
import assert from 'node:assert/strict';
import {splitTranslationTerms} from '../src/lib/translation-text.js';
import {validateWorkDraft,draftFromWork} from '../src/lib/work-content.js';
import {createProject} from '../src/lib/project-management.js';
import {translatedCanvasGrowth} from '../src/lib/language-canvas-layout.js';
import {containsLocalEditorMarkup} from './release-html-checks.mjs';
test('双语标题保存、恢复，并兼容旧作品',()=>{
 const source={title:'测试标题',titleEn:'A custom English title',blocks:[]};const saved=validateWorkDraft(source);
 assert.equal(draftFromWork(saved).titleEn,source.titleEn);assert.equal(validateWorkDraft({...source,titleEn:undefined}).titleEn,'');assert.throws(()=>validateWorkDraft({...source,titleEn:42}));
 const work=createProject({...source,category:'test'},[],[{slug:'test'}]);assert.equal(work.titleEn,source.titleEn);
});
test('英文换行增长不重复计算并排行，中文可恢复原始坐标',()=>{
 const input=[{y:0,height:30,extra:40},{y:0,height:50,extra:20},{y:90,height:120,extra:0},{y:250,height:30,extra:10},{y:320,height:200,extra:0}];
 const result=translatedCanvasGrowth(input);assert.deepEqual(result.shifts,[0,0,20,20,30]);assert.equal(result.extra,30);
 assert.deepEqual(translatedCanvasGrowth(input.map(item=>({...item,extra:0}))).shifts,[0,0,0,0,0]);
});
test('发布检查拒绝真实编辑界面，允许语言脚本中的选择器字符串',()=>{
 assert.equal(containsLocalEditorMarkup('<script>const ignore="[data-about-portrait-editor],[data-translation-dialog]";</script><main>作品</main>'),false);
 assert.equal(containsLocalEditorMarkup('<dialog class="edit" data-translation-dialog>修改</dialog>'),true);
 assert.equal(containsLocalEditorMarkup('<div data-visual-editor="">画布</div>'),true);
});
