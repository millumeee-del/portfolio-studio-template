import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyScopedTranslationEdits,scopedTranslationEntries,normalizeTranslationScope} from '../src/lib/scoped-translations.js';
const source='我制作了以下镜头的二维动态',a='/projects/motion-design/one/',b='/projects/motion-design/two/';
test('相同中文在不同帖子中独立保存，旧英文保留',()=>{
 const old={version:1,entries:{[source]:{en:'Existing English',manual:true}}};
 const first=applyScopedTranslationEdits(old,a,[{source,en:'English for A'}],[source]);
 assert.equal(scopedTranslationEntries(first,a)[source].en,'English for A');assert.equal(scopedTranslationEntries(first,b)[source].en,'Existing English');assert.deepEqual(first.entries,old.entries);
 const second=applyScopedTranslationEdits(first,b,[{source,en:'English for B'}],[source]);
 assert.equal(scopedTranslationEntries(second,a)[source].en,'English for A');assert.equal(scopedTranslationEntries(second,b)[source].en,'English for B');
 const restored=JSON.parse(JSON.stringify(second));assert.deepEqual(scopedTranslationEntries(restored,a),scopedTranslationEntries(second,a));
 const cleared=applyScopedTranslationEdits(restored,a,[{source,en:''}],[source]);assert.equal(scopedTranslationEntries(cleared,a)[source].en,'');assert.equal(scopedTranslationEntries(cleared,b)[source].en,'English for B');
 assert.equal(old.scopes,undefined);
});
test('必须指定帖子，且只能修改该帖子的文字',()=>{
 assert.equal(normalizeTranslationScope('/edit/motion-design/one/'),a);
 assert.throws(()=>normalizeTranslationScope(undefined));assert.throws(()=>normalizeTranslationScope('//external.test/'));
 assert.throws(()=>applyScopedTranslationEdits({entries:{}},a,[{source:'其他帖子的文字',en:'wrong'}],[source]));
});
import {mkdtemp,readFile,writeFile,rm,rmdir} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createTranslationSaver} from './manual-translations.mjs';
test('实际写入文件时，两篇帖子并发保存也互不覆盖',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'studio-scoped-english-')),file=path.join(directory,'translations.json');
 try{
  await writeFile(file,JSON.stringify({version:1,entries:{[source]:{en:'Original English'}}}));
  const save=createTranslationSaver({file,readStore:()=>JSON.parse(readFileSync(file,'utf8')),sources:()=>[source]});
  await Promise.all([save([{source,en:'Page A English'}],a),save([{source,en:'Page B English'}],b)]);
  const store=JSON.parse(await readFile(file,'utf8'));assert.equal(scopedTranslationEntries(store,a)[source].en,'Page A English');assert.equal(scopedTranslationEntries(store,b)[source].en,'Page B English');assert.equal(store.entries[source].en,'Original English');
 }finally{await rm(file,{force:true});await rmdir(directory);}
});
