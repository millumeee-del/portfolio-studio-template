import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const sourceRoot=fileURLToPath(new URL('../../',import.meta.url));
const root=existsSync(path.join(sourceRoot,'src/data/home-layouts.json'))?sourceRoot:process.cwd();
export function readHomeLayouts(){return JSON.parse(readFileSync(path.join(root,'src/data/home-layouts.json'),'utf8'));}
