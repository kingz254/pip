import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const accounts=[{account_id:'DOT39098596',account_type:'demo',currency:'USD',balance:'9998.88',status:'active'},{account_id:'CR123456',account_type:'real',currency:'USD',balance:'0',status:'active'}];
const events=[];
createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost:5191');
 res.setHeader('Cache-Control','no-store');
 const json=value=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value))};
 if(url.pathname==='/api/deriv/session')return json({authenticated:true});
 if(url.pathname==='/api/deriv/accounts')return json({data:accounts});
 if(url.pathname.endsWith('/otp'))return json({data:{url:'wss://api.derivws.com/trading/v1/options/ws/'+(url.pathname.includes('DOT')?'demo':'real')+'?otp=test-only'}});
 if(url.pathname==='/__test/events'){if(req.method==='POST'){let body='';for await(const chunk of req)body+=chunk;events.push(JSON.parse(body));return json({ok:true})}return json(events)}
 if(url.pathname==='/config.js'){res.setHeader('Content-Type','text/javascript');res.end('window.PF_CONFIG={};');return}
 try {
  let file=url.pathname==='/__test/mock-socket.js'?resolve(root,'tests/fixtures/mock-socket.js'):resolve(root,'public','.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
  if(url.pathname!=='/__test/mock-socket.js' && !file.startsWith(resolve(root,'public')+sep))throw Error();
  if((await stat(file)).isDirectory())file=resolve(file,'index.html');
  let bytes=await readFile(file);
  if(url.pathname==='/fxpro.html')bytes=Buffer.from(bytes.toString().replace('<head>','<head><script src="/__test/mock-socket.js"></script>'));
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.wasm':'application/wasm'})[extname(file)]||'application/octet-stream');res.end(bytes);
 }catch{res.statusCode=404;res.end('Not found')}
}).listen(5191,'127.0.0.1',()=>console.log('Mock account UI: http://localhost:5191/#client-preview — no order can reach Deriv.'));
