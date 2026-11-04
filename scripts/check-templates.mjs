#!/usr/bin/env node
// npm run check-templates
// Scans every file in /downloads for (1) terms listed in config/blocklist.txt and
// (2) author, company and last-modified-by metadata. Prints PASS or FAIL per file.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { join, resolve, dirname, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DL = join(ROOT, 'downloads');
const terms = existsSync(join(ROOT, 'config/blocklist.txt'))
  ? readFileSync(join(ROOT, 'config/blocklist.txt'), 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
  : [];

function unzip(buf) {
  const out = {};
  let eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error('not a zip file');
  const n = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < n; i++) {
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const lho = buf.readUInt32LE(p + 42), name = buf.toString('utf8', p + 46, p + 46 + nlen);
    const ls = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
    const data = buf.subarray(ls, ls + csize);
    out[name] = method === 0 ? data : inflateRawSync(data);
    p += 46 + nlen + elen + clen;
  }
  return out;
}
const tag = (xml, name) => { const m = xml.match(new RegExp(`<(?:\\w+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${name}>`)); return m ? m[1].trim() : ''; };

function check(file) {
  const problems = [];
  const buf = readFileSync(file);
  const ext = extname(file).toLowerCase();
  let text = '';
  if (ext === '.xlsx' || ext === '.docx' || ext === '.pptx') {
    const parts = unzip(buf);
    for (const [name, data] of Object.entries(parts)) if (/\.xml$|\.rels$/.test(name)) text += data.toString('utf8') + '\n';
    const core = parts['docProps/core.xml']?.toString('utf8') || '';
    const app = parts['docProps/app.xml']?.toString('utf8') || '';
    for (const [label, val] of [['author (creator)', tag(core, 'creator')], ['last modified by', tag(core, 'lastModifiedBy')], ['company', tag(app, 'Company')], ['manager', tag(app, 'Manager')]]) {
      if (val) problems.push(`${label} metadata is set: "${val}"`);
    }
  } else if (ext === '.pdf') {
    text = buf.toString('latin1');
    for (const k of ['Author', 'Company', 'Creator']) {
      const m = text.match(new RegExp(`/${k}\\s*\\(([^)]+)\\)`));
      if (m && m[1].trim()) problems.push(`PDF /${k} is set: "${m[1]}"`);
    }
    const x = text.match(/<dc:creator>[\s\S]*?<rdf:li[^>]*>([^<]+)</);
    if (x && x[1].trim()) problems.push(`PDF XMP creator is set: "${x[1]}"`);
  } else {
    text = buf.toString('utf8');
  }
  const hay = text.toLowerCase();
  for (const t of terms) if (hay.includes(t.toLowerCase())) problems.push(`contains blocklisted term "${t}"`);
  return problems;
}

const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = existsSync(DL) ? walk(DL).filter((f) => !/(^|\/)\./.test(relative(DL, f)) && !f.endsWith('.gitkeep')) : [];
let failed = 0;
console.log(`Checking ${files.length} file(s) in downloads/ against ${terms.length} blocklist term(s)\n`);
for (const f of files) {
  let problems;
  try { problems = check(f); } catch (e) { problems = [`could not be read: ${e.message}`]; }
  if (problems.length) { failed++; console.log(`FAIL  ${relative(ROOT, f)}`); problems.forEach((p) => console.log(`      - ${p}`)); }
  else console.log(`PASS  ${relative(ROOT, f)}`);
}
console.log(failed ? `\nFAIL: ${failed} file(s) need attention.` : '\nPASS: no blocklisted terms and no author, company or last-modified-by metadata found.');
process.exit(failed ? 1 : 0);
