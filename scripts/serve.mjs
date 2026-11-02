// Tiny zero-dependency dev server: `npm run dev` then open http://localhost:5173
// If node_modules/three is installed, the CDN import map is rewritten to the local copy (works offline).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 5173);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary' };
const hasLocalThree = fs.existsSync(path.join(root, 'node_modules/three/build/three.module.js'));
const CDN = /https:\/\/cdn\.jsdelivr\.net\/npm\/three@[\d.]+\//g;

http
  .createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(root, p);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      return res.end('not found');
    }
    let body = fs.readFileSync(file);
    const ext = path.extname(file);
    if (ext === '.html' && hasLocalThree) body = body.toString().replace(CDN, '/node_modules/three/');
    res.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  })
  .listen(port, () => console.log(`Dev server: http://localhost:${port}${hasLocalThree ? ' (local three)' : ''}`));
