import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(),skip=new Set(['node_modules','dist','.astro','.git']);let checked=0;const findings=[];
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){if(skip.has(entry.name))continue;const file=path.join(dir,entry.name),rel=path.relative(root,file).replaceAll('\\','/');if(entry.isDirectory()){
 if(/^(?:\.codex-backups|\.visitor-data|\.publish-state|\.wrangler|\.cloudflare|\.openai)$/.test(entry.name))findings.push(rel+': private runtime directory');else await walk(file);
 }else{
 if(/(?:^\.env(?:\.|$)|^\.dev.vars|\.(?:sqlite|db|pem|key|zip)$)/i.test(entry.name)&&entry.name!=='.env.example')findings.push(rel+': private or generated file');
 if(!/\.(?:js|mjs|ts|astro|json|jsonc|md|css|yml|yaml|example|sql|txt)$/.test(file)&&entry.name!=='LICENSE')continue;
 checked++;const s=await readFile(file,'utf8');
 if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(s))findings.push(rel+': private key');
 if(/(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9]{32,})/.test(s))findings.push(rel+': credential pattern');
 if(/[A-Za-z]:[\\/]Users[\\/][A-Za-z0-9_.-]+/.test(s))findings.push(rel+': absolute user directory');
 for(const mail of s.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g))if(!/example\.(?:com|org|net)$/.test(mail[0])&&!mail[0].startsWith('fonts@'))findings.push(rel+': non-example email');
 }} }
await walk(root);if(findings.length){console.error([...new Set(findings)].join('\n'));process.exitCode=1;}else console.log(`Share audit passed: ${checked} text files; no matched credentials, private runtime files, user paths or non-example emails.`);
