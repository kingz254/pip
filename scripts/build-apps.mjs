import './export-client-backgrounds.mjs';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, writeFile, rm } from 'node:fs/promises';
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
for(const [folder,route] of [['digits-no-chart-app','digits'],['rise-fall-app','rise-fall'],['accumulators-app','accumulators']]) {
  const result=spawnSync(process.execPath,[process.env.npm_execpath,'run','build','--','--webpack'],{cwd:resolve(root,'apps',folder),stdio:'inherit',env:{...process.env,PIPFORGE_BUILD:'1',NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_BASE_PATH:'/apps/'+route,NEXT_PUBLIC_DERIV_APP_NAME:'Trading workspace'}});
  if(result.status!==0)process.exit(result.status||1);
  await cp(resolve(root,'apps',folder,'.next-build'),resolve(root,'public/apps',route),{recursive:true});
}
await mkdir(resolve(root,'public'),{recursive:true});
for(const entry of await readdir(resolve(app,'dist'))) {
  if(['index.html','markup','deriv-callback.html','deriv-callback.js','service-worker.js','test-bot-urls.html'].includes(entry))continue;
  if(['config.js','kingori.html','fxpro-preview.js'].includes(entry))throw new Error('Runtime asset conflicts with Pipforge: '+entry);
  await cp(resolve(app,'dist',entry),resolve(root,'public',entry),{recursive:true});
}
let html=await readFile(resolve(app,'dist/index.html'),'utf8');
html=html.replace('</head>','<script src="/client-background.js" defer></script></head>');
await writeFile(resolve(root,'public/fxpro.html'),html);

// Vercel gives static index.html precedence over rewrites, so keep it only in the server bundle.
const output=resolve(root,'site-output');
await cp(resolve(root,'public'),output,{recursive:true,filter:source=>source!==resolve(root,'public/index.html')});
await rm(resolve(output,'index.html'),{force:true});

