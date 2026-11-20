import siteEntry from '../api/site-entry.mjs';
import clientSite from '../api/client-site.mjs';
import { createServer, request as proxyRequest } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createDerivAuth } from './deriv-auth.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dev = process.argv.includes('--dev'), port = Number(process.env.PORT || 5173);
const origin = process.env.APP_ORIGIN || `http://localhost:${port}`;
const apps = { bot: ['bot-app', 4003], digits: ['digits-no-chart-app', 3002], 'rise-fall': ['rise-fall-app', 3003], accumulators: ['accumulators-app', 3001] };
const auth = createDerivAuth({ origin, clientId: process.env.DERIV_CLIENT_ID, redirectUri: process.env.DERIV_REDIRECT_URI });
const children = [];
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp', '.woff2':'font/woff2', '.wasm':'application/wasm' };
if (dev && process.env.PF_LEGACY_APPS === '1') for (const [key, [name, appPort]] of Object.entries(apps)) {
  const executable = key === 'bot' ? resolve(root,'node_modules/@rsbuild/core/bin/rsbuild.js') : resolve(root,'node_modules/next/dist/bin/next');
  const args = key === 'bot' ? [executable,'dev','--port',String(appPort),'--host','127.0.0.1'] : [executable,'dev','--port',String(appPort),'--hostname','127.0.0.1'];
  const child = spawn(process.execPath,args,{cwd:resolve(root,'apps',name),stdio:'inherit',env:{...process.env,NEXT_PUBLIC_DERIV_ENV:'production',NEXT_PUBLIC_BASE_PATH:`/apps/${key}`,NEXT_PUBLIC_DERIV_APP_NAME:'Pipforge',NEXT_TELEMETRY_DISABLED:'1'}});
  child.on('error',()=>console.error(`${name} could not start.`)); children.push(child);
}
const server = createServer(async (req,res) => {
  let url;
  try { url = new URL(req.url, origin); } catch { res.writeHead(400).end(); return; }
  if (await auth(req,res,url)) return;
  if (url.pathname === '/') { await siteEntry(req,res); return; }
  if (url.pathname === '/api/client-site') { await clientSite(req,res); return; }
  const appKey = url.pathname.match(/^\/apps\/([^/]+)/)?.[1];
  if (dev && process.env.PF_LEGACY_APPS === '1' && apps[appKey]) {
    const upstream = proxyRequest({ hostname:'127.0.0.1',port:apps[appKey][1],path:req.url,method:req.method,headers:{...req.headers,host:new URL(origin).host}}, response => { res.writeHead(response.statusCode,response.headers); response.pipe(res); });
    upstream.on('error',()=> { if (!res.headersSent) res.writeHead(503,{'Content-Type':'text/html','Refresh':'3'}); res.end('<p>The trading app is starting. This page will retry shortly.</p>'); });
    req.pipe(upstream); return;
  }
  try {
    let path=resolve(root,'public','.'+decodeURIComponent(url.pathname));
    if (!path.startsWith(resolve(root,'public')+sep) && path!==resolve(root,'public')) { res.writeHead(403).end();return; }
    let info=await stat(path);if(info.isDirectory())path=resolve(path,'index.html');
    const content=await readFile(path);res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(content);
  } catch { res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found'); }
});
server.on('upgrade',(req,socket,head)=>{
  socket.on('error',()=>socket.destroy());
  const key=req.url.match(/^\/apps\/([^/]+)/)?.[1];
  if (!dev || !apps[key]) { socket.destroy();return; }
  const upstream=proxyRequest({hostname:'127.0.0.1',port:apps[key][1],path:req.url,headers:req.headers});
  upstream.on('upgrade',(response,target,targetHead)=>{ target.on('error',()=>socket.destroy());socket.on('error',()=>target.destroy());socket.write(`HTTP/1.1 101 Switching Protocols\r\n${Object.entries(response.headers).map(([k,v])=>`${k}: ${v}`).join('\r\n')}\r\n\r\n`);if(head.length)target.write(head);if(targetHead.length)socket.write(targetHead);target.pipe(socket);socket.pipe(target); });
  upstream.on('error',()=>socket.destroy());upstream.end();
});
server.listen(port,()=>console.log(`Pipforge live preview: ${origin}`));
const stop=()=>{for(const child of children)child.kill();server.close(()=>process.exit());};
process.on('SIGINT',stop);process.on('SIGTERM',stop);
