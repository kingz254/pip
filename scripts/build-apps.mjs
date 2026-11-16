import { spawnSync } from 'node:child_process';
import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
for(const [key,name] of Object.entries({bot:'bot-app',digits:'digits-no-chart-app','rise-fall':'rise-fall-app',accumulators:'accumulators-app'})){
  if(!process.env.npm_execpath)throw new Error('Run this build with npm run build.');
  const result=spawnSync(process.execPath,[process.env.npm_execpath,'run','build','--workspace',`@pipforge/${name}`],{cwd:root,stdio:'inherit',env:{...process.env,PIPFORGE_BUILD:'1',NEXT_PUBLIC_BASE_PATH:`/apps/${key}`,NEXT_PUBLIC_DERIV_ENV:'production',NEXT_TELEMETRY_DISABLED:'1'}});
  if(result.status!==0)process.exit(result.status||1);
  await mkdir(`${root}/public/apps/${key}`,{recursive:true});
  await cp(`${root}/apps/${name}/${key==='bot'?'dist':'.next-build'}`,`${root}/public/apps/${key}`,{recursive:true});
}
