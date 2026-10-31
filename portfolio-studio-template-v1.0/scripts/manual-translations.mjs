import {writeFile,rename} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {readTranslationStore,translationFile,translationSources} from '../src/lib/translation-catalog.server.js';
import {applyScopedTranslationEdits} from '../src/lib/scoped-translations.js';
export function createTranslationSaver({readStore=readTranslationStore,file=translationFile,sources=translationSources}={}){
 let writeQueue=Promise.resolve();
 return function saveTranslationEdits(entries,scope){
 const operation=writeQueue.then(async()=>{
  const saved=applyScopedTranslationEdits(readStore(),scope,entries,sources(scope));
  const temporary=file+'.'+randomUUID()+'.tmp';await writeFile(temporary,JSON.stringify(saved,null,2)+'\n');await rename(temporary,file);return saved;
 });writeQueue=operation.catch(()=>{});return operation;
 };
}
export const saveTranslationEdits=createTranslationSaver();
