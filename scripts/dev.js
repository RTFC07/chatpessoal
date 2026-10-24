// Servidor local que imita a Vercel: arquivos estáticos + /api/*.js. Uso: npm run dev (porta 3000).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const raiz = path.resolve(import.meta.dirname, '..');
const tipos = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      const arquivo = path.join(raiz, `${url.pathname}.js`);
      if (!fs.existsSync(arquivo)) return res.writeHead(404).end();
      const { default: handler } = await import(pathToFileURL(arquivo).href);
      req.query = Object.fromEntries(url.searchParams);
      res.status = (c) => ((res.statusCode = c), res);
      res.json = (o) => (res.setHeader('Content-Type', 'application/json'), res.end(JSON.stringify(o)));
      return handler(req, res);
    }
    const arquivo = path.join(raiz, url.pathname === '/' ? 'index.html' : url.pathname);
    if (!arquivo.startsWith(raiz) || !fs.existsSync(arquivo)) return res.writeHead(404).end('não achei');
    res.writeHead(200, { 'Content-Type': tipos[path.extname(arquivo)] ?? 'application/octet-stream' });
    fs.createReadStream(arquivo).pipe(res);
  })
  .listen(3000, () => console.log('Botilde Eleições em http://localhost:3000'));
