#!/usr/bin/env node
// Static site builder. No dependencies: reads /data/*.json and writes /dist.
//   npm run build
// Netlify: build command `npm run build`, publish directory `dist`.
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const warn = (m) => console.warn('  warning: ' + m);

// ---------------------------------------------------------------- data
function readJson(rel) {
  try {
    return JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
  } catch (e) {
    console.error(`\nCould not read ${rel}: ${e.message}\nCheck for a missing comma or quote near the place named above.\n`);
    process.exit(1);
  }
}
const site = readJson('data/site.json');
const experience = readJson('data/experience.json').items || [];
const writingAll = readJson('data/writing.json').items || [];
const templatesAll = readJson('data/templates.json').items || [];
const C = site.copy || {};

const has = (v) => typeof v === 'string' ? v.trim() !== '' : v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0);
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const abs = (p) => site.url.replace(/\/$/, '') + p;
const year = new Date().getFullYear();
const buildDate = new Date().toISOString().slice(0, 10);
const fmtDate = (iso) => {
  const d = new Date(iso + 'T00:00:00Z');
  return isNaN(d) ? '' : new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(d);
};
const hash = (rel) => createHash('sha1').update(readFileSync(join(ROOT, rel))).digest('hex').slice(0, 8);
const v = {};
for (const f of ['css/site.css', 'css/toolkit.css', 'css/resume.css', 'js/track.js', 'js/main.js', 'js/toolkit.js']) v[f] = hash(f);
const asset = (f) => `/${f}?v=${v[f]}`;

// ---------------------------------------------------------------- derived content
const hasPhoto = existsSync(join(ROOT, 'images/headshot.jpg'));
const emailB64 = Buffer.from([...site.email].reverse().join('')).toString('base64');
const emailFallback = site.email.replace('@', ' (at) ').replace(/\.(?=[^.]*$)/, ' (dot) ');
const writing = writingAll
  .filter((w) => has(w.title) && has(w.url) && has(w.date))
  .sort((a, b) => b.date.localeCompare(a.date));
const showResources = site.showResources !== false;
const showToolkit = site.showToolkit !== false;

const FORMAT_LABEL = { xlsx: 'Excel', docx: 'Word', pdf: 'PDF' };
const liveTemplates = [];
for (const t of templatesAll) {
  if (t.status !== 'live') continue;
  if (!has(t.id) || !has(t.title)) { warn(`a live template is missing id or title and was skipped`); continue; }
  if (t.fulfillment === 'file') {
    if (!has(t.path) || !existsSync(join(ROOT, t.path))) { warn(`template "${t.id}" is live but its file is missing (${t.path || 'no path'}); skipped`); continue; }
  } else if (t.fulfillment === 'url') {
    if (!/^https:\/\//.test(t.url || '')) { warn(`template "${t.id}" is live but has no https url; skipped`); continue; }
  } else { warn(`template "${t.id}" has an unknown fulfillment; skipped`); continue; }
  liveTemplates.push(t);
}
liveTemplates.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '') || a.title.localeCompare(b.title));
const money = (n) => (Number(n) > 0 ? '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }) : 'Free');

// ---------------------------------------------------------------- shared html
const arch = '<svg class="mark" viewBox="0 0 24 28" aria-hidden="true" focusable="false"><path d="M2 28V12C2 5 6.5 1 12 1s10 4 10 11v16z" fill="currentColor"/></svg>';

function head({ title, description, path, noindex = false, og = true, css = [], ld = null, extra = '' }) {
  const canonical = abs(path);
  const img = abs('/images/og-image.png');
  const analytics = JSON.stringify(site.analytics || { provider: 'none' }).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
${noindex ? '<meta name="robots" content="noindex">' : ''}
<meta name="theme-color" content="#F6EFE5">
<link rel="icon" href="/images/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/fonts/playfair.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/dmsans.woff2" as="font" type="font/woff2" crossorigin>
${og ? `<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(site.name)}. ${esc(site.tagline)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(img)}">` : ''}
<link rel="stylesheet" href="${asset('css/site.css')}">
${css.map((f) => `<link rel="stylesheet" href="${asset(f)}"${f === 'css/resume.css' ? '' : ''}>`).join('\n')}
<script type="application/json" id="site-config">${JSON.stringify({ analytics: JSON.parse(analytics) })}</script>
${ld ? `<script type="application/ld+json">${JSON.stringify(ld)}</script>` : ''}
${extra}
</head>`;
}

function scripts(extra = []) {
  return [asset('js/track.js'), asset('js/main.js'), ...extra].map((s) => `<script src="${s}" defer></script>`).join('\n');
}

function simpleHeader(label = 'Back to home') {
  return `<header class="bar"><div class="bar__in"><a class="bar__home" href="/">${arch}<span>${esc(site.name)}</span></a><a class="bar__back" href="/">${esc(label)}</a></div></header>`;
}

function footer() {
  const links = [
    ['/resume/', 'Resume'],
    showToolkit ? ['/toolkit/', 'Office ops HQ demo'] : null,
    showResources ? ['/toolkit/templates/', 'Templates'] : null,
    has(site.linkedin) ? [site.linkedin, 'LinkedIn', true] : null,
  ].filter(Boolean);
  return `<footer class="foot"><div class="wrap foot__in"><p>&copy; ${year} ${esc(site.name)}</p><ul>${links
    .map(([h, l, ext]) => `<li><a href="${esc(h)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${esc(l)}</a></li>`)
    .join('')}</ul></div></footer>`;
}

function emailSpan(extraClass = '') {
  return `<span class="${extraClass}" data-email="${emailB64}">${esc(emailFallback)}</span>`;
}

function honeypot() {
  return `<p class="hp" aria-hidden="true"><label>Leave this field empty <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>`;
}

function trackProps(o) { return esc(JSON.stringify(o)); }

function templateRow(t, source, detailed = false) {
  const isFile = t.fulfillment === 'file';
  const meta = [FORMAT_LABEL[t.format] || String(t.format || '').toUpperCase(), has(t.version) ? 'Version ' + t.version : '', has(t.updatedAt) ? 'Updated ' + fmtDate(t.updatedAt) : '', money(t.price)];
  if (detailed && has(t.category)) meta.unshift(t.category);
  const label = Number(t.price) > 0 ? 'Get it' : isFile ? 'Download' : 'Open';
  const href = isFile ? '/' + t.path.replace(/^\//, '') : t.url;
  const props = trackProps({ template_id: t.id, version: t.version || '', source });
  const also = (t.alsoAs || []).filter((a) => has(a.path) && existsSync(join(ROOT, a.path)))
    .map((a) => `<a class="textlink" href="/${esc(a.path.replace(/^\//, ''))}" download data-track="template_download_click" data-track-props="${trackProps({ template_id: t.id, version: t.version || '', source, format: a.format })}">Also as ${esc(FORMAT_LABEL[a.format] || a.format)}</a>`).join('');
  return `<li class="res">
<div class="res__main"><h3>${esc(t.title)}</h3>${has(t.description) ? `<p>${esc(t.description)}</p>` : ''}<p class="res__meta">${meta.filter(has).map(esc).join(' &middot; ')}</p>${detailed && has(t.license) ? `<p class="res__lic">${esc(t.license)}</p>` : ''}</div>
<div class="res__act"><a class="btn btn--small btn--ghost" href="${esc(href)}"${isFile ? ' download' : ' target="_blank" rel="noopener"'} data-track="template_download_click" data-track-props="${props}">${label}<span class="visually-hidden">: ${esc(t.title)}</span></a>${also}</div>
</li>`;
}

// ---------------------------------------------------------------- home
function home() {
  const expandable = experience.some((x) => has(x.context) || has(x.whatIDid) || has(x.result));
  const nav = [
    ['about', C.navAbout || 'About'],
    ['experience', C.navExperience],
    ['services', C.navServices],
    writing.length ? ['writing', C.navWriting] : null,
    showResources ? ['resources', C.navResources] : null,
    ['background', C.navBackground],
    ['contact', C.navContact],
  ].filter(Boolean);

  const stats = (site.stats || []).filter((s) => has(String(s.value)) && has(s.label));
  const heroArt = hasPhoto
    ? `<div class="art art--photo" aria-hidden="false"><span class="arch arch--b" aria-hidden="true"></span><span class="arch arch--a"><img src="/images/headshot.jpg" alt="Portrait of ${esc(site.name)}" width="800" height="1000" fetchpriority="high" decoding="async"></span><span class="arch arch--d" aria-hidden="true"></span></div>`
    : `<div class="art" aria-hidden="true"><span class="arch arch--b"></span><span class="arch arch--a"></span><span class="arch arch--d"></span></div>`;
  const [first, ...rest] = site.name.split(' ');

  const xp = experience.filter((x) => has(x.summary)).map((x) => {
    const parts = [['Context', x.context], ['What I did', x.whatIDid], ['Result', x.result]].filter(([, t]) => has(t));
    if (!parts.length) return `<li class="xp__item"><p class="xp__summary">${esc(x.summary)}</p></li>`;
    return `<li class="xp__item"><details><summary><span class="xp__summary">${esc(x.summary)}</span><span class="xp__icon" aria-hidden="true"></span></summary><dl class="xp__body">${parts.map(([k, t]) => `<div><dt>${k}</dt><dd>${esc(t)}</dd></div>`).join('')}</dl></details></li>`;
  }).join('');

  const board = (site.board || []).filter((b) => has(b.role) && has(b.organization));
  const edu = (site.education || []).filter((e) => has(e.credential) && has(e.institution));

  const resources = showResources ? `
<section class="section resources" id="resources" aria-labelledby="h-resources">
<div class="wrap">
<h2 id="h-resources">${esc(C.resourcesHeading)}</h2>
${has(C.resourcesIntro) ? `<p class="section__lede">${esc(C.resourcesIntro)}</p>` : ''}
<ul class="ruled">
${showToolkit ? `<li class="res"><div class="res__main"><h3>Office ops HQ demo</h3><p>A scaled-down workplace operations dashboard you can click through, filled with sample data for a made-up company.</p></div><div class="res__act"><a class="btn btn--small btn--ghost" href="/toolkit/">Open the demo</a></div></li>` : ''}
${liveTemplates.map((t) => templateRow(t, 'home')).join('\n')}
</ul>
<p class="more"><a class="textlink" href="/toolkit/templates/">All templates and request one</a></p>
</div>
</section>` : '';

  const writingSec = writing.length ? `
<section class="section writing" id="writing" aria-labelledby="h-writing">
<div class="wrap">
<h2 id="h-writing">${esc(C.writingHeading)}</h2>
${has(C.writingIntro) ? `<p class="section__lede">${esc(C.writingIntro)}</p>` : ''}
<ul class="ruled">
${writing.map((w) => `<li class="post"><time datetime="${esc(w.date)}">${esc(fmtDate(w.date))}</time><div><h3><a href="${esc(w.url)}" target="_blank" rel="noopener">${esc(w.title)}<span class="visually-hidden"> (opens in a new tab)</span></a></h3>${has(w.summary) ? `<p>${esc(w.summary)}</p>` : ''}</div></li>`).join('\n')}
</ul>
</div>
</section>` : '';

  const body = `<body class="home">
<a class="skip" href="#main">Skip to content</a>
<header class="nav" id="top">
<div class="nav__in">
<a class="nav__name" href="#top">${arch}<span>${esc(site.name)}</span></a>
<nav aria-label="Primary"><ul>${nav.map(([id, l]) => `<li><a href="#${id}">${esc(l)}</a></li>`).join('')}</ul></nav>
</div>
</header>
<main id="main">
<section class="hero" aria-labelledby="name">
<div class="hero__text">
${has(site.eyebrow) ? `<p class="eyebrow">${esc(site.eyebrow)}</p>` : ''}
<h1 id="name" class="hero__name"><span class="line"><span>${esc(first)}</span></span> <span class="line"><span>${esc(rest.join(' '))}</span></span></h1>
<p class="hero__tagline">${esc(site.tagline)}</p>
<div class="hero__cta"><a class="btn btn--primary" href="#contact">${esc(C.ctaContact)}</a><a class="btn btn--ghost" href="/resume/">${esc(C.ctaResume)}</a></div>
</div>
${heroArt}
</section>
${stats.length ? `<section class="stats" aria-labelledby="h-stats"><h2 id="h-stats" class="stats__title">${esc(C.statsHeading)}</h2><ul class="stats__list">
${stats.map((s) => `<li><span class="visually-hidden">${esc([s.qualifier, s.value, s.label].filter(has).join(' '))}</span><span aria-hidden="true">${has(s.qualifier) ? `<span class="stat__q">${esc(s.qualifier)}</span>` : '<span class="stat__q">&nbsp;</span>'}<span class="stat__n" data-count="${esc(s.value)}">${esc(s.value)}</span><span class="stat__l">${esc(s.label)}</span></span></li>`).join('\n')}
</ul></section>` : ''}
<section class="section intro" id="about" aria-label="${esc(C.navAbout || 'About')}">
<div class="wrap intro__grid">
<p class="intro__lead">${esc(site.intro)}</p>
${has(site.intro2) ? `<p class="intro__second">${esc(site.intro2)}</p>` : ''}
</div>
</section>
<section class="section experience" id="experience" aria-labelledby="h-xp">
<div class="wrap xp__grid">
<div class="xp__head"><h2 id="h-xp">${esc(C.experienceHeading)}</h2>${expandable && has(C.experienceIntro) ? `<p>${esc(C.experienceIntro)}</p>` : ''}</div>
<ul class="xp">${xp}</ul>
</div>
</section>
<section class="section services" id="services" aria-labelledby="h-services">
<div class="wrap">
<h2 id="h-services">${esc(C.servicesHeading)}</h2>
<ul class="skills">${(site.services || []).filter(has).map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
</div>
</section>
${writingSec}
${resources}
${board.length || edu.length ? `<section class="section background" id="background" aria-label="${esc(C.navBackground)}">
<div class="wrap"><div class="bg">
${board.length ? `<div class="bg__col"><h2>${esc(C.boardHeading)}</h2><ul>${board.map((b) => `<li>${esc(b.role)}, ${esc(b.organization)}</li>`).join('')}</ul></div>` : ''}
${edu.length ? `<div class="bg__col"><h2>${esc(C.educationHeading)}</h2><ul>${edu.map((e) => `<li>${esc([e.credential, e.institution, e.note].filter(has).join(', '))}</li>`).join('')}</ul></div>` : ''}
</div></div>
</section>` : ''}
<section class="contact" id="contact" aria-labelledby="h-contact">
<div class="wrap contact__grid">
<div class="contact__text">
<h2 id="h-contact">${esc(C.contactHeading)}</h2>
${has(C.contactIntro) ? `<p>${esc(C.contactIntro)}</p>` : ''}
<ul class="contact__links">
<li>${emailSpan('mail')}</li>
<li><button type="button" class="btn btn--small btn--light" data-copy-email data-email="${emailB64}" data-copied="${esc(C.copiedEmail)}">${esc(C.copyEmail)}</button> <span class="visually-hidden" role="status" aria-live="polite" data-copy-status></span></li>
${has(site.linkedin) ? `<li><a class="textlink textlink--light" href="${esc(site.linkedin)}" target="_blank" rel="noopener">LinkedIn<span class="visually-hidden"> (opens in a new tab)</span></a></li>` : ''}
</ul>
</div>
<div class="sheet">
<form name="contact" method="POST" action="/thanks/" data-netlify="true" netlify-honeypot="bot-field" data-ajax data-track-submit="contact_submit" data-success="${esc(C.formSuccess)}" data-error="${esc(C.formError)}">
<input type="hidden" name="form-name" value="contact">
${honeypot()}
<div class="field"><label for="c-name">Name</label><input id="c-name" name="name" type="text" autocomplete="name" required></div>
<div class="field"><label for="c-email">Email</label><input id="c-email" name="email" type="email" autocomplete="email" required></div>
<div class="field"><label for="c-msg">Message</label><textarea id="c-msg" name="message" rows="5" required></textarea></div>
<button class="btn btn--primary" type="submit">Send message</button>
<p class="form__status" role="status" aria-live="polite" data-status></p>
</form>
</div>
</div>
</section>
</main>
${footer()}
${scripts()}
</body>
</html>`;

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: site.name,
    jobTitle: site.jobTitle,
    url: site.url,
    sameAs: [site.linkedin].filter(has),
  };
  return head({ title: site.title, description: site.description, path: '/', ld }) + '\n' + body;
}

// ---------------------------------------------------------------- resume
function resume() {
  const board = (site.board || []).filter((b) => has(b.role) && has(b.organization));
  const edu = (site.education || []).filter((e) => has(e.credential) && has(e.institution));
  const body = `<body class="resume-page" data-track-view="resume_view">
<div class="toolbar no-print"><div class="toolbar__in"><a class="textlink" href="/">Back to site</a><button type="button" class="btn btn--small btn--primary" data-print>Save as PDF</button></div><p class="toolbar__hint">Opens your print dialog. Choose &ldquo;Save as PDF&rdquo; as the destination.</p></div>
<main id="main" class="sheet-wrap">
<article class="cv">
<header class="cv__head">
<h1>${esc(site.name)}</h1>
<p class="cv__role">${esc(site.jobTitle)}</p>
<p class="cv__contact">${emailSpan('mail')}${has(site.linkedin) ? ` <span aria-hidden="true">&middot;</span> <a href="${esc(site.linkedin)}">${esc(site.linkedin.replace(/^https?:\/\/(www\.)?/, ''))}</a>` : ''}</p>
</header>
<div class="cv__grid">
<div class="cv__main">
<section><h2>Summary</h2><p>${esc(site.intro)}</p>${has(site.intro2) ? `<p>${esc(site.intro2)}</p>` : ''}</section>
<section><h2>${esc(C.experienceHeading)}</h2><ul>${experience.filter((x) => has(x.summary)).map((x) => `<li>${esc(x.summary)}${[x.context, x.whatIDid, x.result].filter(has).map((t) => ` ${esc(t)}`).join('')}</li>`).join('')}</ul></section>
</div>
<aside class="cv__side">
<section><h2>${esc(C.servicesHeading)}</h2><ul>${(site.services || []).filter(has).map((s) => `<li>${esc(s)}</li>`).join('')}</ul></section>
${board.length ? `<section><h2>${esc(C.boardHeading)}</h2><ul>${board.map((b) => `<li>${esc(b.role)}, ${esc(b.organization)}</li>`).join('')}</ul></section>` : ''}
${edu.length ? `<section><h2>${esc(C.educationHeading)}</h2><ul>${edu.map((e) => `<li>${esc([e.credential, e.institution, e.note].filter(has).join(', '))}</li>`).join('')}</ul></section>` : ''}
</aside>
</div>
</article>
</main>
${scripts()}
</body>
</html>`;
  return head({ title: `Resume | ${site.name}`, description: `Resume of ${site.name}, ${site.jobTitle}.`, path: '/resume/', css: ['css/resume.css'] }) + '\n' + body;
}

// ---------------------------------------------------------------- toolkit
function toolkit() {
  const body = `<body class="toolkit-page" data-track-view="demo_opened">
${simpleHeader()}
<main id="main">
<div class="wrap tk__intro">
<h1>Office ops HQ demo</h1>
<p class="tk__label"><strong>Demo with sample data.</strong> Nothing you enter leaves your browser.</p>
<p>A scaled-down version of a workplace operations dashboard, filled with obviously fictional sample data for a made-up company. Add, edit, filter, and sort rows, then reset or export to CSV whenever you like.${showResources ? ' <a class="textlink" href="/toolkit/templates/">Free templates</a> are available too.' : ''}</p>
</div>
<div class="wrap">
<div id="demo" data-src="/data/demo-hq.json"><noscript><p class="tk__label">The demo needs JavaScript to run in your browser.</p></noscript></div>
</div>
</main>
${footer()}
${scripts([asset('js/toolkit.js')])}
</body>
</html>`;
  return head({
    title: `Office ops HQ demo | ${site.name}`,
    description: 'An interactive demo of a workplace operations dashboard with sample data. Runs entirely in your browser.',
    path: '/toolkit/',
    css: ['css/toolkit.css'],
  }) + '\n' + body;
}

function templatesPage() {
  const body = `<body class="templates-page">
${simpleHeader()}
<main id="main">
<div class="wrap tk__intro">
<h1>Templates</h1>
<p>Free, generic templates for workplace operations and executive support. Each one shows its version and when it was last updated.</p>
</div>
<div class="wrap">
${liveTemplates.length ? `<ul class="ruled">${liveTemplates.map((t) => templateRow(t, 'templates', true)).join('\n')}</ul>` : ''}
<section class="request sheet" aria-labelledby="h-request">
<h2 id="h-request">Request a template</h2>
<p>Tell me what template would help you. Your email is optional and used only to reply to you.</p>
<form name="template-request" method="POST" action="/thanks/" data-netlify="true" netlify-honeypot="bot-field" data-ajax data-track-submit="template_request_submit" data-success="Thank you. Your request is in, and I'll use it to decide what to build next." data-error="${esc(C.formError)}">
<input type="hidden" name="form-name" value="template-request">
${honeypot()}
<div class="field"><label for="r-what">What template would help you?</label><textarea id="r-what" name="request" rows="4" required></textarea></div>
<div class="field"><label for="r-email">Email (optional)</label><input id="r-email" name="email" type="email" autocomplete="email" aria-describedby="r-note"><p id="r-note" class="field__note">Optional. Used only to reply to you.</p></div>
<button class="btn btn--primary" type="submit">Send request</button>
<p class="form__status" role="status" aria-live="polite" data-status></p>
</form>
</section>
</div>
</main>
${footer()}
${scripts()}
</body>
</html>`;
  return head({
    title: `Templates | ${site.name}`,
    description: 'Free templates for workplace operations and executive support: vendor tracker, run-of-show, and office move checklist.',
    path: '/toolkit/templates/',
  }) + '\n' + body;
}

function notFound() {
  return head({ title: `Page not found | ${site.name}`, description: 'This page could not be found.', path: '/404.html', noindex: true, og: false }) + `
<body class="notfound">
${simpleHeader()}
<main id="main" class="nf"><div class="wrap nf__in">
<div class="art art--small" aria-hidden="true"><span class="arch arch--b"></span><span class="arch arch--a"></span></div>
<div><h1>That page isn&rsquo;t here.</h1><p>It may have moved, or the link may be mistyped.</p><p><a class="btn btn--primary" href="/">Back to the home page</a></p></div>
</div></main>
${footer()}
${scripts()}
</body>
</html>`;
}

function thanks() {
  return head({ title: `Thank you | ${site.name}`, description: 'Thank you for getting in touch.', path: '/thanks/', noindex: true, og: false }) + `
<body class="notfound">
${simpleHeader()}
<main id="main" class="nf"><div class="wrap nf__in">
<div class="art art--small" aria-hidden="true"><span class="arch arch--b"></span><span class="arch arch--a"></span></div>
<div><h1>Thank you.</h1><p>${esc(C.formSuccess)}</p><p><a class="btn btn--primary" href="/">Back to the home page</a></p></div>
</div></main>
${footer()}
${scripts()}
</body>
</html>`;
}

// ---------------------------------------------------------------- write
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
const put = (rel, content) => { const p = join(DIST, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, content); };

put('index.html', home());
put('resume/index.html', resume());
put('toolkit/index.html', toolkit());
if (showResources) put('toolkit/templates/index.html', templatesPage());
put('404.html', notFound());
put('thanks/index.html', thanks());

const urls = ['/', '/resume/', '/toolkit/', showResources ? '/toolkit/templates/' : null].filter(Boolean);
put('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${abs(u)}</loc><lastmod>${buildDate}</lastmod></url>`).join('\n')}\n</urlset>\n`);
put('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${abs('/sitemap.xml')}\n`);

for (const d of ['css', 'js', 'fonts', 'images']) if (existsSync(join(ROOT, d))) cpSync(join(ROOT, d), join(DIST, d), { recursive: true });
mkdirSync(join(DIST, 'data'), { recursive: true });
cpSync(join(ROOT, 'data/demo-hq.json'), join(DIST, 'data/demo-hq.json'));
// Only files referenced by live entries are published; drafts stay out of dist.
for (const t of liveTemplates) {
  const files = [];
  if (t.fulfillment === 'file') files.push(t.path);
  for (const a of t.alsoAs || []) if (has(a.path) && existsSync(join(ROOT, a.path))) files.push(a.path);
  for (const f of files) { mkdirSync(dirname(join(DIST, f)), { recursive: true }); cpSync(join(ROOT, f), join(DIST, f)); }
}
const fcount = liveTemplates.length;
console.log(`Built to dist/: ${urls.length} pages + 404 + thanks, ${fcount} live template${fcount === 1 ? '' : 's'}, ${writing.length} writing item${writing.length === 1 ? '' : 's'}, headshot ${hasPhoto ? 'found' : 'not found (hero shown without photo)'}.`);
