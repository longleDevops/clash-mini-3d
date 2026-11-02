// Bundles src/ into ONE self-contained page for the shared Claude artifact:
//   dist/skyward-minis.html  (fragment: the artifact host adds <html>/<head>/<body>)
//   dist/play.html           (same game as a normal standalone HTML document)
// three.js stays external (jsDelivr import map) so the page stays small.
// Usage: npm run build            -> CDN three (publishable)
//        npm run build -- --local -> /node_modules three (offline testing via `npm run dev`)
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const local = process.argv.includes('--local');
const check = process.argv.includes('--check');

const result = await build({
  entryPoints: [path.join(root, 'src/main.js')],
  bundle: true,
  format: 'esm',
  external: ['three', 'three/addons/*'],
  minify: true,
  write: false,
  target: 'es2022', // top-level await (hero bodies load before the game starts)
  legalComments: 'none',
  logLevel: 'warning',
});
let js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = ['styles.css', 'scenes.css'].map((f) => fs.readFileSync(path.join(root, 'src/ui', f), 'utf8')).join('\n');
// Binary assets (Blender GLBs under assets/) are embedded as base64 so the page stays one file.
const assets = {};
(function scan(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) scan(f);
    else if (/\.glb$/i.test(e.name)) assets[path.relative(root, f).split(path.sep).join('/')] = fs.readFileSync(f).toString('base64');
  }
})(path.join(root, 'assets'));
js = `globalThis.__SKYWARD_ASSETS__=${JSON.stringify(assets)};\n` + js;
let page = fs.readFileSync(path.join(root, 'src/app.html'), 'utf8').replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => js);
if (local) page = page.replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/three@[\d.]+\//g, '/node_modules/three/');

if (check) {
  console.log(`ok: bundle ${(js.length / 1024).toFixed(1)} KB, page ${(page.length / 1024).toFixed(1)} KB, assets: ${Object.keys(assets).join(', ') || 'none'}`);
  process.exit(0);
}
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/skyward-minis.html'), page);
const doc = `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${page}\n</html>\n`;
fs.writeFileSync(path.join(root, 'dist/play.html'), doc);
console.log(`built dist/skyward-minis.html (${(page.length / 1024).toFixed(1)} KB)${local ? ' [local three]' : ''}`);
