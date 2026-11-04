// Optional dev tool: renders scripts/og-source.html to images/og-image.png (1200x630).
// Needs Playwright (not a site dependency): npm i -D playwright && node scripts/generate-og.mjs
import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.goto(pathToFileURL(resolve(here, 'og-source.html')).href);
await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: resolve(here, '../images/og-image.png') });
await b.close();
