import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export function isBuilderHost(host, mainOrigin = process.env.APP_ORIGIN) {
  const hostname = String(host || '').split(':')[0].toLowerCase();
  const hosts = ['localhost', '127.0.0.1', 'pip-coral-seven.vercel.app', 'pip-kingz254.vercel.app'];
  if (mainOrigin) hosts.push(new URL(mainOrigin).hostname);
  return hosts.includes(hostname);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Host');
  try {
    const file = isBuilderHost(req.headers.host) ? 'index.html' : 'fxpro.html';
    const html = await readFile(resolve(process.cwd(), 'public', file));
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(html);
  } catch {
    res.statusCode = 503;
    res.end('Your trading site is temporarily unavailable. Please try again.');
  }
}
