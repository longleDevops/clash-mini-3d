// Export a hero's code-built model as a Blender blockout (see README.md next to this file).
//   node tools/blender/export-blockout.mjs [unit=lyra] [out=tools/blender/<unit>_blockout.glb]
// Needs node_modules/three (npm install) and Playwright's Chromium.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const unit = process.argv[2] || 'lyra';
const out = path.resolve(root, process.argv[3] || `tools/blender/${unit}_blockout.glb`);
const port = 5199;

const server = spawn(process.execPath, [path.join(root, 'scripts/serve.mjs')], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
try {
  await new Promise((r) => setTimeout(r, 400));
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(`http://localhost:${port}/tools/blender/blockout.html?unit=${unit}`);
  await page.waitForFunction(() => document.title === 'ready', null, { timeout: 60000 });
  const { base64, report } = await page.evaluate(() => window.exportBlockout());
  fs.writeFileSync(out, Buffer.from(base64, 'base64'));
  console.log(`wrote ${path.relative(root, out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
  console.log(JSON.stringify(report, null, 1));
  await browser.close();
} finally {
  server.kill();
}
