import './export-client-backgrounds.mjs';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const app=resolve(root,'client-runtime/fxprotradesite');
if(!process.env.npm_execpath)throw new Error('Run this build with npm run build.');
for(const args of [['ci','--include=dev','--ignore-scripts','--no-audit','--no-fund'],['exec','--','rsbuild','build']]) {
  if(args[0]==='ci' && process.env.PF_REUSE_RUNTIME_DEPS==='1')continue;
  const result=spawnSync(process.execPath,[process.env.npm_execpath,...args],{cwd:app,stdio:'inherit',env:{...process.env,NODE_ENV:'production'}});
  if(result.status!==0)process.exit(result.status||1);
}
await mkdir(resolve(root,'public'),{recursive:true});
for(const entry of await readdir(resolve(app,'dist'))) {
  if(['index.html','markup','deriv-callback.html','deriv-callback.js','service-worker.js','test-bot-urls.html'].includes(entry))continue;
  if(['config.js','admin.html','fxpro-preview.js'].includes(entry))throw new Error('Runtime asset conflicts with Pipforge: '+entry);
  await cp(resolve(app,'dist',entry),resolve(root,'public',entry),{recursive:true});
}
let html=await readFile(resolve(app,'dist/index.html'),'utf8');
html=html.replace('</head>','<script src="/client-background.js" defer></script></head>');
await writeFile(resolve(root,'public/fxpro.html'),html);
