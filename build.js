#!/usr/bin/env node
/* Evanssion static site generator.
   Content lives in src/content.json (extracted from the reviewed content draft).
   node build.js          -> dist/ with relative links ending in index.html (opens from disk)
   node build.js --prod   -> dist/ with clean root-absolute URLs for hosting */
const fs = require('fs');
const path = require('path');

const PROD = process.argv.includes('--prod');
const ORIGIN = 'https://www.evanssion.com';
const PORTAL_URL = 'https://portal.evanssion.com/'; // login app, separate subdomain (to be confirmed)
const LINKEDIN = 'https://www.linkedin.com/company/evanssion/';
const MAPS = 'https://maps.app.goo.gl/4DN5GKFSHXBSQBLT7';
const ADDRESS = '201, Techno Hub 2, Dubai Silicon Oasis, Dubai, UAE';
const SRC = path.join(__dirname, 'src');
const DIST = path.join(__dirname, 'dist');
const data = JSON.parse(fs.readFileSync(path.join(SRC, 'content.json'), 'utf8'));
const warn = [];

/* ------------------------------------------------------------------ tokens */
const LIGHT = {
  bg: '#FFFFFF', alt: '#F5F5F7', 'bg-elev': '#FFFFFF', fg: '#1D1D1F', 'fg-2': '#5F5F66',
  accent: '#BF3F0A', 'accent-fg': '#FFFFFF', line: '#8A8A90', hair: 'rgba(0,0,0,.10)', fill: '#E8E8ED',
  shadow: '0 8px 30px rgba(0,0,0,.12)',
};
const DARK = {
  bg: '#0A0B0E', alt: '#14161B', 'bg-elev': '#1B1E24', fg: '#F5F5F7', 'fg-2': '#A6A8AF',
  accent: '#FF8A4C', 'accent-fg': '#1A0A02', line: '#7C7F88', hair: 'rgba(255,255,255,.12)', fill: '#262A31',
  shadow: '0 8px 30px rgba(0,0,0,.6)',
};
const decl = (t) => Object.entries(t).map(([k, v]) => `--${k}:${v}`).join(';');
const TOKENS = `:root{${decl(LIGHT)};color-scheme:light}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${decl(DARK)};color-scheme:dark}}
:root[data-theme="dark"]{${decl(DARK)};color-scheme:dark}
:root[data-theme="light"]{${decl(LIGHT)};color-scheme:light}`;

/* ------------------------------------------------------------------ page model */
const slugOf = (u) => u.split('/').filter(Boolean).pop();
const pages = [];
for (const d of data) {
  if (['38', '42'].includes(String(d.n))) continue;
  if (d.n === 41) continue; // handled below
  pages.push({ n: d.n, name: d.name, spec: d.spec, sections: d.sections, URL: d.spec.URL });
}
const errData = data.find((d) => d.n === 41);
pages.push({ n: 41, name: 'Page not found', URL: '/404.html', noindex: true, sections: [], spec: { URL: '/404.html', 'Page type': 'Utility 404', 'Title tag': 'Page not found | Evanssion', 'Meta description': 'This page could not be found.', H1: 'We could not find that page', 'Primary CTA': 'Go to home' } });
pages.push({ n: 41.5, name: 'Thank you', URL: '/thank-you/', noindex: true, sections: [], spec: { URL: '/thank-you/', 'Page type': 'Utility confirmation', 'Title tag': 'Thank you | Evanssion', 'Meta description': 'Thank you for contacting Evanssion.', H1: 'Thank you, we have your message', 'Primary CTA': 'Go to home' } });

const byUrl = {};
const vendors = [], solutions = [], regions = [];
for (const p of pages) {
  byUrl[p.URL] = p;
  if (/^\/vendors\/[^/]+\/$/.test(p.URL) && p.URL !== '/vendors/become-a-vendor/') vendors.push(p);
  if (/^\/solutions\/[^/]+\/$/.test(p.URL)) solutions.push(p);
  if (/^\/regions\/[^/]+\/$/.test(p.URL)) regions.push(p);
}
const vendorByName = Object.fromEntries(vendors.map((v) => [v.name.toLowerCase(), v]));
const solutionByName = (n) => solutions.find((s) => s.name.toLowerCase().startsWith(n.toLowerCase().replace(/\.$/, '')));

/* vendor metadata from the vendors hub and solutions hub tables */
const hubV = pages.find((p) => p.URL === '/vendors/');
const vendorMeta = {};
for (const sec of hubV.sections) for (const b of sec.blocks) if (b.t === 'table') for (const r of b.rows) vendorMeta[r[0].toLowerCase()] = { group: sec.title, what: r[1] };
const hubS = pages.find((p) => p.URL === '/solutions/');
const solRows = hubS.sections.flatMap((s) => s.blocks).filter((b) => b.t === 'table')[0].rows;
const vendorSolutions = {};
for (const [sol, , vs] of solRows) for (const v of vs.split(',').map((x) => x.trim())) (vendorSolutions[v.toLowerCase()] ||= []).push(sol);

/* glossary terms */
const glossary = pages.find((p) => p.URL === '/insights/glossary/');
const termRows = glossary.sections.flatMap((s) => s.blocks).filter((b) => b.t === 'table')[0].rows;
const termSlug = (t) => t.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const TERM_REL = {
  aspm: ['/solutions/vulnerability-management/', '/vendors/defectdojo/'], 'shadow-ai': ['/solutions/ai-security/', '/vendors/witnessai/'],
  'prompt-injection': ['/solutions/ai-security/', '/vendors/witnessai/'], mcp: ['/solutions/ai-security/', '/vendors/backflipt/'],
  a2a: ['/solutions/ai-security/', '/vendors/backflipt/'], 'indicator-of-future-attack': ['/solutions/threat-intelligence/', '/vendors/silent-push/'],
  'software-supply-chain-security': ['/solutions/software-supply-chain-security/', '/vendors/reversinglabs/'], microsegmentation: ['/solutions/breach-containment/', '/vendors/illumio/'],
  'lateral-movement': ['/solutions/breach-containment/', '/vendors/illumio/'], 'security-data-fabric': ['/solutions/security-operations/'],
  'ai-soc': ['/solutions/security-operations/', '/vendors/arambh-labs/'], 'value-added-distributor': ['/partners/', '/vendors/become-a-vendor/'],
};
const terms = termRows.map(([term, def]) => ({ term, def, slug: termSlug(term), URL: `/insights/glossary/${termSlug(term)}/` }));
for (const t of terms) {
  pages.push({ n: 36.1, name: t.term, URL: t.URL, glossTerm: t, sections: [], spec: {
    URL: t.URL, 'Page type': 'Glossary term', 'Title tag': `What is ${t.term.replace(/\s*\(.*\)/, '')}? | Evanssion Glossary`.slice(0, 60),
    'Meta description': t.def.length > 155 ? t.def.slice(0, 152).replace(/\s+\S*$/, '') + '...' : t.def,
    H1: `What is ${t.term.replace(/\s*\(.*\)/, '')}?`, Schema: 'DefinedTerm, BreadcrumbList', 'Primary CTA': 'Explore solutions' } });
  byUrl[t.URL] = pages[pages.length - 1];
}

const typeOf = (p) => {
  const u = p.URL;
  if (p.glossTerm) return 'term';
  if (u === '/') return 'home'; if (u === '/about/') return 'about'; if (u === '/contact/') return 'contact';
  if (u === '/vendors/') return 'vendorHub'; if (u === '/vendors/become-a-vendor/') return 'becomeVendor';
  if (vendors.includes(p)) return 'vendor'; if (u === '/solutions/') return 'solutionHub'; if (solutions.includes(p)) return 'solution';
  if (u === '/partners/') return 'partnerLanding'; if (u === '/partners/become-a-partner/') return 'becomePartner';
  if (u === '/partners/our-partners/') return 'partnerDir'; if (u === '/partners/portal/') return 'portal';
  if (regions.includes(p)) return 'region'; if (u === '/insights/') return 'insights'; if (u === '/insights/glossary/') return 'glossary';
  if (u === '/events/') return 'events'; if (u === '/privacy/' || u === '/terms/') return 'legal';
  if (u === '/404.html') return 'notFound'; if (u === '/thank-you/') return 'thanks';
  throw new Error('No template for ' + u);
};

/* ------------------------------------------------------------------ links */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const depthOf = (u) => (u.endsWith('.html') ? u.split('/').length - 2 : u.split('/').filter(Boolean).length);
const fileOf = (u) => (u.endsWith('.html') ? u.slice(1) : (u === '/' ? 'index.html' : u.slice(1) + 'index.html'));
let CUR = '/';
const pre = () => '../'.repeat(depthOf(CUR));
const href = (to) => {
  if (/^(https?:|mailto:|tel:|#)/.test(to)) return to;
  const [p, q] = to.split('?');
  if (PROD) return to;
  return pre() + fileOf(p) + (q ? '?' + q : '');
};
const asset = (f) => (PROD ? '/assets/' + f : pre() + 'assets/' + f);
const ext = (u) => (/^https?:/.test(u) ? ' target="_blank" rel="noopener"' : '');

/* ------------------------------------------------------------------ text helpers */
const vendorNames = vendors.map((v) => v.name).sort((a, b) => b.length - a.length);
/* escape, then link the first mention of each vendor (not the current page) */
function rich(text, { link = true, self } = {}) {
  let h = esc(text);
  h = h.replace(/(https?:\/\/[^\s<]+?)([.,;]?)(\s|$)/g, (m, u, tail, sp) => `<a href="${u}"${ext(u)}>${u.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a>${tail}${sp}`);
  if (link) {
    for (const n of vendorNames) {
      if (self && self.name === n) continue;
      const re = new RegExp(`(^|[^>\\w/])(${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?![\\w</"-])`);
      h = h.replace(re, (m, a, name) => `${a}<a href="${href(vendorByName[name.toLowerCase()].URL)}">${name}</a>`);
    }
  }
  return h;
}
const labelled = (t) => { const m = t.match(/^([^:]{2,42}):\s+(.+)$/); return m ? `<strong>${esc(m[1])}:</strong> ${m[2]}` : t; };

/* ------------------------------------------------------------------ primitives */
const slot = (t) => `<p class="slot">${esc(t)}</p>`;
const PAGE_IMG = {
  'home-hero': 'Abstract glass shields forming a protective dome over the Middle East and Africa',
  'about-team': 'Quiet modern office in Dubai Silicon Oasis at dusk',
  'sol-ai-security': 'Neural network sphere inside a protective ring',
  'sol-application-security': 'Application windows linked by API lines with a filter intercepting one',
  'sol-threat-intelligence': 'Dotted globe with data arcs converging on a radar sweep',
  'sol-supply-chain': 'Chain of software packages on a path with one being verified',
  'sol-vulnerability': 'Asset grid with glowing weak points being mapped',
  'sol-security-operations': 'Data ribbons from many sources flowing into one hub',
  'sol-grc': 'Layered documents and balanced geometric blocks with check markers',
  'sol-breach-containment': 'Network cells separated by glass walls with one sealed off',
  'region-uae': 'Stylised Dubai skyline at blue hour',
  'region-saudi-arabia': 'Stylised Riyadh skyline at desert dusk',
  'region-bahrain': 'Stylised Manama waterfront at dusk',
  'region-africa': 'Dotted map of Africa and the Middle East with glowing hubs',
};
const SOL_IMG = { 'ai-security': 'sol-ai-security', 'application-security': 'sol-application-security', 'threat-intelligence': 'sol-threat-intelligence', 'software-supply-chain-security': 'sol-supply-chain', 'vulnerability-management': 'sol-vulnerability', 'security-operations': 'sol-security-operations', 'grc-compliance': 'sol-grc', 'breach-containment': 'sol-breach-containment' };
const IMG_EXT = ['jpg', 'jpeg', 'png', 'webp'];
/* uses src/img/pages/<name>.(jpg|png|webp) when present, otherwise the grey placeholder */
const media = (label, name) => {
  const ext = IMG_EXT.find((e) => fs.existsSync(path.join(SRC, 'img/pages', name + '.' + e)));
  if (ext) return `<img class="media-img" src="${asset('img/pages/' + name + '.' + ext)}" alt="${esc(PAGE_IMG[name] || label)}" width="1536" height="1024" decoding="async">`;
  return `<div class="media" role="img" aria-label="Image placeholder: ${esc(label)}" style="--ar:3 / 2">${esc(label)}</div>`;
};
const btn = (label, to, kind = 'primary') => `<a class="btn btn-${kind}" href="${href(to)}"${ext(to)}>${esc(label)}</a>`;

function ctaTarget(label) {
  const l = label.toLowerCase();
  if (/sales@/.test(l)) return 'mailto:sales@evanssion.com';
  if (/\+971/.test(l)) return 'tel:+971586061121';
  if (/partner login/.test(l)) return PORTAL_URL;
  if (/talk to us about the region/.test(l)) return '/contact/?type=vendor';
  if (/browse all vendors|explore vendors|see our vendors|back to all vendors|vendors directory/.test(l)) return '/vendors/';
  if (/become a partner|apply|partner programme/.test(l)) return '/partners/become-a-partner/';
  if (/browse solutions|explore solutions/.test(l)) return '/solutions/';
  if (/subscribe/.test(l)) return '#subscribe';
  if (/talk to|contact|request a briefing|send enquiry|register|not sure where/.test(l)) return '/contact/';
  if (/go to home/.test(l)) return '/';
  return '/contact/';
}
const ctaBtns = (labels, first = 'primary') => `<div class="actions">${labels.map((l, i) => btn(l, ctaTarget(l), i === 0 ? first : 'secondary')).join('')}</div>`;
const band = (labels, headline = 'Ready to talk?') =>
  `<section class="band"><div class="wrap"><h2>${esc(headline)}</h2>${ctaBtns(labels)}</div></section>`;

const faqHtml = (items) => `<div class="faq">${items.map((f, i) => `<details${i === 0 ? ' open' : ''}><summary>${esc(f.q)}</summary><div class="ans"><p>${rich(f.a, { link: false })}</p></div></details>`).join('')}</div>`;
const tableHtml = (b, o = {}) => `<div class="table-wrap"><table><thead><tr>${b.head.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((c, i) => `<${i === 0 ? 'th scope="row"' : 'td'}>${o.cell ? o.cell(c, i, r) : rich(c)}</${i === 0 ? 'th' : 'td'}>`).join('')}</tr>`).join('')}</tbody></table></div>`;

function renderBlock(b, ctx) {
  switch (b.t) {
    case 'lede': return `<p class="prose lead">${rich(b.text, { self: ctx.page })}</p>`;
    case 'p': return `<p class="prose">${rich(b.text, { self: ctx.page })}</p>`;
    case 'ul': return `<ul class="list">${b.items.map((i) => `<li>${labelled(rich(i, { self: ctx.page }))}</li>`).join('')}</ul>`;
    case 'ol': return `<ol class="steps">${b.items.map((i) => `<li><span>${rich(i, { self: ctx.page })}</span></li>`).join('')}</ol>`;
    case 'table': return tableHtml(b);
    case 'cards': return `<div class="grid g${b.items.length >= 3 ? 3 : 2}">${b.items.map((c) => `<div class="card"><h3>${esc(c.title)}</h3><p>${rich(c.text.join(' '))}</p></div>`).join('')}</div>`;
    case 'faq': return faqHtml(b.items);
    case 'leader': return '';
    default: return '';
  }
}

const sec = (title, inner, o = {}) =>
  `<section class="sec${o.alt ? ' alt' : ''}"${o.id ? ` id="${o.id}"` : ''}><div class="wrap sec-grid"><div class="sec-title"><h2>${esc(title)}</h2></div><div class="sec-body">${inner}</div></div></section>`;
const secWide = (title, inner, o = {}) =>
  `<section class="sec${o.alt ? ' alt' : ''}"${o.id ? ` id="${o.id}"` : ''}><div class="wrap"><div class="sec-head"><h2>${esc(title)}</h2>${o.sub ? `<p class="prose">${esc(o.sub)}</p>` : ''}</div>${inner}</div></section>`;

function hero(p, { side, kicker, actions, lede } = {}) {
  const ledeB = p.sections[0] && p.sections[0].blocks.find((b) => b.t === 'lede');
  const introCta = p.sections[0] && p.sections[0].blocks.find((b) => b.t === 'cta');
  const labels = introCta ? introCta.labels : String(p.spec['Primary CTA'] || '').split(/\s*(?:\/|\|)\s*/).filter(Boolean);
  const acts = actions !== undefined ? actions : labels.length ? ctaBtns(labels) : '';
  const l = lede || (ledeB && ledeB.text);
  return `<header class="hero${side ? ' has-media' : ''}"><div class="wrap"><div class="hero-copy">${kicker ? `<p class="eyebrow">${esc(kicker)}</p>` : ''}<h1>${esc(p.spec.H1)}</h1>${l ? `<p class="lede">${rich(l, { self: p })}</p>` : ''}${acts}</div>${side || ''}</div></header>`;
}

/* ------------------------------------------------------------------ forms */
const field = (id, label, o = {}) => `<div class="field${o.cls ? ' ' + o.cls : ''}"><label for="${id}">${esc(label)}${o.req === false ? ' <span class="muted">(optional)</span>' : ''}</label><input id="${id}" name="${o.name || id}" type="${o.type || 'text'}"${o.req === false ? '' : ' required'}${o.ac ? ` autocomplete="${o.ac}"` : ''}></div>`;
const area = (id, label, req = false) => `<div class="field"><label for="${id}">${esc(label)}${req ? '' : ' <span class="muted">(optional)</span>'}</label><textarea id="${id}" name="${id}"${req ? ' required' : ''}></textarea></div>`;
const select = (id, label, opts) => `<div class="field"><label for="${id}">${esc(label)}</label><select id="${id}" name="${id}" required><option value="">Select</option>${opts.map((o) => `<option>${esc(o)}</option>`).join('')}</select></div>`;
const checks = (name, legend, opts) => `<fieldset class="field checks"><legend>${esc(legend)}</legend><div class="check-grid">${opts.map((o, i) => `<label class="check"><input type="checkbox" name="${name}" value="${esc(o)}"><span>${esc(o)}</span></label>`).join('')}</div></fieldset>`;
const consent = (id) => `<label class="check consent-line"><input id="${id}" name="consent" type="checkbox" required><span>I agree to Evanssion contacting me about this enquiry and processing my details as described in the <a href="${href('/privacy/')}">privacy notice</a>.</span></label>`;
const formShell = (id, type, inner, submit) =>
  `<form class="form" id="${id}" data-lead data-type="${type}" novalidate><input type="text" name="website_url" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">${inner}${consent(id + '-consent')}<div class="form-foot"><button class="btn btn-primary" type="submit">${esc(submit)}</button><p class="form-msg" role="status" aria-live="polite"></p></div></form>`;
const vendorOpts = () => vendors.map((v) => v.name);
const solutionOpts = () => solutions.map((s) => s.name);

function contactForm() {
  const types = [['partner', 'I want to become a partner'], ['vendor', 'I am a vendor'], ['enterprise', 'I am an enterprise buyer']];
  const base = field('c-name', 'Name', { ac: 'name' }) + field('c-email', 'Work email', { type: 'email', ac: 'email' }) + field('c-company', 'Company', { ac: 'organization' });
  const fs = {
    partner: field('c-p-country', 'Country') + select('c-p-type', 'Partner type', ['Reseller', 'Systems integrator', 'Managed security provider']) + checks('vendors', 'Vendors of interest', vendorOpts()) + area('c-p-msg', 'Message'),
    vendor: field('c-v-site', 'Website', { type: 'url' }) + field('c-v-product', 'Product and category') + checks('regions', 'Regions you want to cover', ['UAE', 'Saudi Arabia', 'Bahrain', 'Other Middle East', 'Africa']) + area('c-v-msg', 'Message'),
    enterprise: field('c-e-country', 'Country') + select('c-e-area', 'Area of interest', solutionOpts()) + area('c-e-msg', 'Message'),
  };
  return formShell('contact-form', 'partner', `<fieldset class="field types"><legend>I am…</legend>${types.map(([v, l], i) => `<label class="radio"><input type="radio" name="enquiry" value="${v}"${i === 0 ? ' checked' : ''}><span>${l}</span></label>`).join('')}</fieldset>${base}${Object.entries(fs).map(([k, h]) => `<div class="type-fields" data-for="${k}">${h}</div>`).join('')}`, 'Send enquiry');
}
function partnerForm() {
  const inner = `<div class="field-row">${field('a-company', 'Company name', { ac: 'organization' })}${field('a-site', 'Website', { type: 'url' })}</div>
<div class="field-row">${field('a-country', 'Country')}${field('a-city', 'City')}</div>
<div class="field-row">${field('a-year', 'Year established', { type: 'number' })}${field('a-staff', 'Number of staff', { type: 'number' })}${field('a-sec', 'Security staff', { type: 'number' })}</div>
${select('a-type', 'Partner type', ['Reseller', 'Systems integrator', 'Managed security provider', 'Other'])}
<div class="field-row">${field('a-contact', 'Contact name', { ac: 'name' })}${field('a-title', 'Job title', { ac: 'organization-title' })}</div>
<div class="field-row">${field('a-email', 'Work email', { type: 'email', ac: 'email' })}${field('a-phone', 'Phone', { type: 'tel', ac: 'tel' })}</div>
${checks('vendors', 'Vendors of interest', vendorOpts())}
${area('a-sectors', 'Target customer sectors and countries')}
${field('a-current', 'Security vendors you sell today', { req: false })}`;
  return formShell('partner-form', 'partner-application', inner, 'Submit application');
}
const subscribeForm = () => `<form class="form inline" id="subscribe-form" data-lead data-type="subscribe" novalidate><input type="text" name="website_url" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true"><div class="field"><label for="s-email">Work email</label><input id="s-email" name="email" type="email" required autocomplete="email"></div>${consent('s-consent')}<div class="form-foot"><button class="btn btn-primary" type="submit">Subscribe</button><p class="form-msg" role="status" aria-live="polite"></p></div></form>`;

/* ------------------------------------------------------------------ templates */
const sectionsOf = (p) => p.sections.filter((s) => s.title);
const findSec = (p, re) => p.sections.find((s) => s.title && re.test(s.title));
let altFlip = false;
function generic(p, skip = [], extraEnd = '') {
  altFlip = false;
  const ctx = { page: p };
  const parts = [];
  for (const s of sectionsOf(p)) {
    if (skip.some((re) => re.test(s.title))) continue;
    const blocks = s.blocks.filter((b) => b.t !== 'cta' && b.t !== 'related');
    if (!blocks.length) continue;
    const isFaq = blocks.some((b) => b.t === 'faq');
    altFlip = !altFlip;
    parts.push(sec(s.title, blocks.map((b) => renderBlock(b, ctx)).join(''), { alt: altFlip && !isFaq }));
  }
  return parts.join('') + extraEnd;
}
const endBand = (p, headline) => {
  const labels = [];
  for (const s of p.sections) for (const b of s.blocks) if (b.t === 'cta' && s.title) for (const l of b.labels) if (!labels.includes(l)) labels.push(l);
  const first = p.sections[0].blocks.find((b) => b.t === 'cta');
  const use = labels.length ? labels : (first ? first.labels : ['Request a briefing']);
  return band(use, headline);
};
/* vendor logos sit on a white plate in both themes so each brand's own colours stay intact */
const vlogo = (v, big) => `<span class="vlogo${big ? ' big' : ''}"><img src="${asset('img/vendors/' + slugOf(v.URL) + '.png')}" alt="${esc(v.name)} logo" loading="lazy"></span>`;
const vendorTile = (v) => `<a class="card vendor-card" href="${href(v.URL)}">${vlogo(v)}<h3 class="vname">${esc(v.name)}</h3><p class="small muted">${esc((vendorMeta[v.name.toLowerCase()] || {}).what || '')}</p><span class="go">View vendor →</span></a>`;
const solutionCard = (s, sub) => `<a class="card" href="${href(s.URL)}"><h3>${esc(s.name)}</h3>${sub ? `<p class="small muted">${esc(sub)}</p>` : ''}<span class="go">Explore →</span></a>`;
const faqOf = (p) => p.sections.flatMap((s) => s.blocks).find((b) => b.t === 'faq');

const T = {
  home(p) {
    const s = (re) => findSec(p, re);
    const three = s(/Three ways/).blocks[0].items;
    const threeHref = ['/partners/', '/vendors/become-a-vendor/', '/contact/'];
    const threeGo = ['For partners', 'For vendors', 'Talk to us'];
    const groups = {};
    for (const v of vendors) (groups[(vendorMeta[v.name.toLowerCase()] || {}).group || 'Other'] ||= []).push(v);
    const sols = s(/Find the right solution/).blocks[0].items.map((i) => { const [q, n] = i.split(/:\s+/); return { q, page: solutionByName(n) }; });
    const stats = s(/at a glance/).blocks[0].items.map((i) => { const m = i.match(/^([\d,]+\+?)\s+(.+)$/); return m ? { n: m[1], l: m[2].replace(/^(Years in the Middle)$/, 'Years in the Middle East') } : null; }).filter(Boolean);
    const why = s(/Why work with/);
    const where = s(/Where we work/);
    const what = s(/What does Evanssion do/);
    return hero(p, { side: media('Hero visual', 'home-hero') }) +
      sec('What does Evanssion do?', what.blocks.map((b) => renderBlock(b, { page: p })).join('')) +
      secWide('Three ways to work with us', `<div class="grid g3">${three.map((c, i) => `<a class="card" href="${href(threeHref[i])}"><h3>${esc(c.title)}</h3><p>${esc(c.text.join(' '))}</p><span class="go">${threeGo[i]} →</span></a>`).join('')}</div>`, { alt: true }) +
      secWide(s(/Our portfolio/).title, Object.entries(groups).map(([g, vs]) => `<h3 class="group">${esc(g)}</h3><div class="grid g4">${vs.map(vendorTile).join('')}</div>`).join('')) +
      secWide('Find the right solution by problem', `<div class="grid g4">${sols.map((x) => solutionCard(x.page, x.q)).join('')}</div>`, { alt: true }) +
      sec(why.title, renderBlock(why.blocks[0], { page: p })) +
      `<section class="sec alt"><div class="wrap"><div class="sec-head"><h2>Evanssion at a glance</h2></div><dl class="stats">${stats.map((x) => `<div><dt>${esc(x.l)}</dt><dd>${esc(x.n)}</dd></div>`).join('')}</dl></div></section>` +
      sec(where.title, where.blocks.map((b) => renderBlock(b, { page: p })).join('') + `<p class="actions"><a class="btn btn-secondary" href="${href('/regions/uae/')}">UAE</a><a class="btn btn-secondary" href="${href('/regions/saudi-arabia/')}">Saudi Arabia</a><a class="btn btn-secondary" href="${href('/regions/bahrain/')}">Bahrain</a><a class="btn btn-secondary" href="${href('/regions/africa/')}">Africa and wider MEA</a></p>`) +
      secWide('Latest insights', `<a class="card wide" href="${href('/insights/')}"><h3>Guides and regional analysis</h3><p class="muted">Practical guides on AI security, application security, threat intelligence and compliance in the Gulf.</p><span class="go">Read insights →</span></a>`, { alt: true }) +
      sec('Frequently asked questions', renderBlock(faqOf(p), { page: p })) +
      band(['Talk to us', 'sales@evanssion.com', '+971 58 606 1121'], 'Talk to us');
  },

  about(p) {
    const leaders = findSec(p, /story and leadership/).blocks.filter((b) => b.t === 'leader').map((b) => {
      const name = b.text.split(',')[0];
      const title = (b.text.match(/^[^,]+,\s*([^:]+):/) || [])[1];
      return { name, title };
    });
    const bios = {
      'Ashok Chakravarthi Arulmozhi': 'Serial entrepreneur who has built multimillion-dollar businesses.',
      'Dilip Kalliyat': 'More than 20 years in the UAE, with strong system integration experience and a solid cybersecurity background.',
      'Mohan Krishnamurthy': 'A strong techno-commercial background, more than 30 years of industry experience, and a published author.',
    };
    const where = findSec(p, /Where we are/);
    return hero(p, { side: media('Team or office image', 'about-team') }) +
      generic(p, [/story and leadership/, /Where we are/]).replace(/<\/section>$/, '</section>') +
      secWide('Our story and leadership', `<div class="grid g3">${leaders.map((l) => `<div class="card person"><img class="portrait" src="${asset('img/team/' + l.name.split(' ')[0].toLowerCase() + '.jpg')}" alt="${esc(l.name)}" width="480" height="557" loading="lazy"><h3>${esc(l.name)}</h3><p class="eyebrow">${esc(l.title)}</p><p class="small">${esc(bios[l.name] || '')}</p></div>`).join('')}</div>`, { alt: true }) +
      sec('Where we are', `<p class="prose"><strong>Evanssion FZCO</strong><br>${esc(ADDRESS)}<br>United Arab Emirates</p><p class="actions"><a class="btn btn-secondary" href="${MAPS}" target="_blank" rel="noopener">Open in Google Maps</a></p>`) +
      endBand(p, 'Work with Evanssion');
  },

  contact(p) {
    const direct = [['Email', '<a href="mailto:sales@evanssion.com">sales@evanssion.com</a>'], ['Phone', '<a href="tel:+971586061121">+971 58 606 1121</a>'], ['Website', '<a href="https://www.evanssion.com">www.evanssion.com</a>'],
      ['Office', `${esc(ADDRESS)} (<a href="${MAPS}" target="_blank" rel="noopener">map</a>)`], ['Working hours', 'Monday to Friday, 9.00 am to 6.00 pm']];
    return hero(p, { actions: '' }) +
      `<section class="sec" id="enquiry"><div class="wrap sec-grid"><div class="sec-title"><h2>Choose your enquiry</h2></div><div class="sec-body">${contactForm()}</div></div></section>` +
      sec('Direct contacts', `<dl class="facts">${direct.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`, { alt: true }) +
      sec('Frequently asked questions', renderBlock(faqOf(p), { page: p }));
  },

  vendorHub(p) {
    const cards = vendors.map((v) => { const m = vendorMeta[v.name.toLowerCase()] || {}; return `<a class="card vendor-card" data-group="${esc(m.group)}" href="${href(v.URL)}">${vlogo(v)}<h3 class="vname">${esc(v.name)}</h3><p class="small muted">${esc(m.what)}</p><span class="chip-tag">${esc(m.group)}</span><span class="go">View vendor →</span></a>`; }).join('');
    const groups = [...new Set(vendors.map((v) => (vendorMeta[v.name.toLowerCase()] || {}).group))];
    const last = findSec(p, /Not sure/);
    return hero(p, { actions: ctaBtns(['Request a briefing']) }) +
      `<section class="sec alt"><div class="wrap"><div class="chips" role="group" aria-label="Filter vendors" data-filter><button class="chip" type="button" data-g="" aria-pressed="true">All</button>${groups.map((g) => `<button class="chip" type="button" data-g="${esc(g)}" aria-pressed="false">${esc(g)}</button>`).join('')}</div><div class="grid g3 filterable">${cards}</div></div></section>` +
      sec(last.title, last.blocks.filter((b) => b.t === 'p').map((b) => renderBlock(b, { page: p })).join('') + ctaBtns(last.blocks.find((b) => b.t === 'cta').labels));
  },

  vendor(p) {
    const m = vendorMeta[p.name.toLowerCase()] || {};
    const sols = (vendorSolutions[p.name.toLowerCase()] || []).map(solutionByName).filter(Boolean);
    const side = `<aside class="card vendor-side" aria-label="Vendor summary">${vlogo(p, true)}<dl class="facts compact"><div><dt>Category</dt><dd>${esc(m.group || '')}</dd></div><div><dt>Distributed by</dt><dd>Evanssion FZCO</dd></div><div><dt>Regions</dt><dd>UAE, Saudi Arabia, Bahrain, wider MEA</dd></div>${sols.length ? `<div><dt>Solutions</dt><dd>${sols.map((s) => `<a href="${href(s.URL)}">${esc(s.name)}</a>`).join('<br>')}</dd></div>` : ''}</dl></aside>`;
    const rel = p.sections.flatMap((s) => s.blocks).find((b) => b.t === 'related');
    const relSols = rel ? (rel.text.match(/solution pages:\s*([^.]+(?:Zero Trust segmentation)?)\./i) || [, ''])[1].split(';').map((x) => solutionByName(x.trim())).filter(Boolean) : sols;
    const others = vendors.filter((v) => v !== p && (vendorMeta[v.name.toLowerCase()] || {}).group === m.group).slice(0, 3);
    const proofNote = '<p class="small muted">Figures are stated by the vendor.</p>';
    let body = generic(p, [/Proof points/]);
    const proof = findSec(p, /Proof points/);
    if (proof) body = body.replace(/(<section class="sec[^"]*"[^>]*><div class="wrap sec-grid"><div class="sec-title"><h2>Buying )/, `<section class="sec"><div class="wrap sec-grid"><div class="sec-title"><h2>Proof points</h2></div><div class="sec-body">${renderBlock(proof.blocks.find((b) => b.t === 'ul'), { page: p })}${proofNote}</div></div></section>$1`);
    return hero(p, { side, kicker: 'Vendor', actions: ctaBtns(['Request a briefing', 'Become a partner']) }) + body +
      secWide('Related', `<div class="grid g3">${relSols.map((s) => solutionCard(s)).join('')}<a class="card" href="${href('/vendors/')}"><h3>All vendors</h3><p class="small muted">Browse the full Evanssion portfolio.</p><span class="go">Vendor directory →</span></a>${others.map(vendorTile).join('')}</div><p class="actions">${['uae', 'saudi-arabia', 'bahrain'].map((r) => btn(byUrl['/regions/' + r + '/'].name, '/regions/' + r + '/', 'secondary')).join('')}</p>`, { alt: true }) +
      band(['Request a briefing', 'Become a partner', 'Back to all vendors'], `Talk to us about ${p.name}`);
  },

  becomeVendor(p) {
    return hero(p, { actions: ctaBtns(['Talk to us about the region']) }) + generic(p) + endBand(p, 'Bring your product to the region');
  },

  solutionHub(p) {
    const cards = solRows.map(([name, problem, vs]) => { const sp = solutionByName(name); return `<a class="card" href="${href(sp.URL)}"><h3>${esc(sp.name)}</h3><p>${esc(problem)}</p><p class="small muted">${esc(vs)}</p><span class="go">Explore →</span></a>`; }).join('');
    return hero(p) + secWide('All solutions', `<div class="grid g2">${cards}</div>`, { alt: true }) + band(['Not sure where to start? Talk to us'], 'Not sure where to start?');
  },

  solution(p) {
    const vs = findSec(p, /Vendors that deliver/);
    const table = vs.blocks.find((b) => b.t === 'table');
    const html = generic(p, [/Vendors that deliver/]);
    const vendorSec = sec(vs.title, tableHtml(table, { cell: (c, i) => (i === 0 && vendorByName[c.toLowerCase()] ? `<a href="${href(vendorByName[c.toLowerCase()].URL)}">${esc(c)}</a>` : rich(c, { link: false })) }));
    // place vendors section after "What good looks like"
    const parts = html.split('</section>').filter(Boolean).map((x) => x + '</section>');
    const idx = parts.findIndex((x) => /What good looks like/.test(x));
    parts.splice(idx + 1, 0, vendorSec);
    const others = solutions.filter((s) => s !== p).slice(0, 3);
    return hero(p, { kicker: 'Solution', side: media('Illustration', SOL_IMG[slugOf(p.spec.URL)]) }) + parts.join('') +
      secWide('Related solutions', `<div class="grid g3">${others.map((s) => solutionCard(s)).join('')}</div>`, { alt: true }) + endBand(p, 'Talk to us about this problem');
  },

  partnerLanding(p) { return hero(p) + generic(p) + endBand(p, 'Join the programme'); },

  becomePartner(p) {
    const html = generic(p, [/Application form fields/]);
    const parts = html.split('</section>').filter(Boolean).map((x) => x + '</section>');
    parts.splice(1, 0, sec('Application form', partnerForm(), { id: 'apply' }));
    return hero(p, { actions: `<div class="actions"><a class="btn btn-primary" href="#apply">Start your application</a></div>` }) + parts.join('');
  },

  partnerDir(p) {
    const empty = findSec(p, /Empty-state/);
    return hero(p) + sec('Directory', `<div class="empty"><p class="prose lead">${esc(empty.blocks[0].text)}</p>${ctaBtns(['Become a partner'])}</div>`);
  },

  portal(p) {
    return hero(p, { actions: `<div class="actions">${btn('Partner login', PORTAL_URL)}${btn('Not a partner yet? Apply', '/partners/become-a-partner/', 'secondary')}</div>` }) + generic(p);
  },

  region(p) {
    return hero(p, { kicker: 'Region', side: media('Regional image', 'region-' + slugOf(p.spec.URL)) }) + generic(p) + endBand(p, 'Talk to our team');
  },

  insights(p) {
    const cats = findSec(p, /Categories/).blocks[0].items;
    const std = findSec(p, /Editorial standards/);
    const plan = findSec(p, /Launch plan/).blocks.find((b) => b.t === 'table');
    return hero(p, { actions: `<div class="actions"><a class="btn btn-primary" href="#subscribe">Subscribe</a></div>` }) +
      secWide('Categories', `<div class="chips static">${cats.map((c) => `<span class="chip">${esc(c)}</span>`).join('')}</div>`, { alt: true }) +
      sec('Coming up', `<p class="prose">Our first articles are in preparation. Each one answers a question buyers and partners ask us.</p><ul class="list">${plan.rows.map((r) => `<li><strong>${esc(r[1])}</strong> <span class="muted">${esc(r[2])}</span></li>`).join('')}</ul>`) +
      sec(std.title.replace(/\s*\(.*\)/, ''), renderBlock(std.blocks[0], { page: p }), { alt: true }) +
      sec('Subscribe', `<p class="prose">Get new articles and event invitations by email.</p>${subscribeForm()}`, { id: 'subscribe' });
  },

  glossary(p) {
    const defs = terms.map((t) => `<div class="term" id="${t.slug}"><dt><a href="${href(t.URL)}">${esc(t.term)}</a></dt><dd>${esc(t.def)}</dd></div>`).join('');
    return hero(p, { actions: ctaBtns(['Explore solutions']) }) + sec('Terms', `<dl class="terms">${defs}</dl>`, { alt: true });
  },

  term(p) {
    const t = p.glossTerm; const rel = (TERM_REL[t.slug] || []).map((u) => byUrl[u]).filter(Boolean);
    return hero(p, { kicker: 'Glossary', lede: t.def, actions: ctaBtns(['Explore solutions']) }) +
      secWide('Related', `<div class="grid g3">${rel.map((r) => `<a class="card" href="${href(r.URL)}"><h3>${esc(r.name)}</h3><span class="go">Read more →</span></a>`).join('')}<a class="card" href="${href('/insights/glossary/')}"><h3>Glossary</h3><p class="small muted">All terms, A to Z.</p><span class="go">Back to glossary →</span></a></div>`, { alt: true });
  },

  events(p) {
    const up = findSec(p, /Upcoming/); const past = findSec(p, /Past events/);
    return hero(p, { actions: ctaBtns(['Register your interest']) }) +
      sec('Upcoming', `<div class="card"><h3>${esc(up.blocks[0].text)}</h3><p class="small muted">Details to follow.</p></div>`, { alt: true }) +
      sec(past.title, `<p class="prose">${esc(past.blocks[0].text)}</p>`);
  },

  legal(p) {
    return hero(p, { actions: '', lede: ' ' }).replace('<p class="lede"> </p>', '') +
      `<section class="sec"><div class="wrap sec-grid"><div class="sec-title"><h2>${p.URL === '/privacy/' ? 'Summary' : 'Contents'}</h2></div><div class="sec-body"><p class="notice">This is an outline. The full text is published after legal review.</p>${p.sections.flatMap((s) => s.blocks).filter((b) => b.t === 'ul').map((b) => renderBlock(b, { page: p })).join('')}</div></div></section>`;
  },

  notFound(p) {
    return hero(p, { kicker: '404', lede: 'That page is not here. Try one of these:', actions: `<div class="actions">${btn('Vendors', '/vendors/')}${btn('Solutions', '/solutions/', 'secondary')}${btn('Partners', '/partners/', 'secondary')}${btn('Contact', '/contact/', 'secondary')}${btn('Go to home', '/', 'secondary')}</div>` });
  },
  thanks(p) {
    return hero(p, { kicker: 'Confirmation', lede: 'We have your message and will reply within 1 working day. While you wait, explore our vendors or read our latest insights.', actions: `<div class="actions">${btn('Explore vendors', '/vendors/')}${btn('Read insights', '/insights/', 'secondary')}</div>` });
  },
};

/* ------------------------------------------------------------------ chrome */
const NAV = [
  { label: 'Vendors', to: '/vendors/', links: vendors.map((v) => [v.name, v.URL]), all: ['All vendors', '/vendors/'], wide: true },
  { label: 'Solutions', to: '/solutions/', links: solutions.map((s) => [s.name, s.URL]), all: ['All solutions', '/solutions/'], wide: true },
  { label: 'Partners', to: '/partners/', links: [['Become a partner', '/partners/become-a-partner/'], ['Our partners', '/partners/our-partners/'], ['Partner portal', '/partners/portal/']], all: ['Partner programme', '/partners/'] },
  { label: 'Regions', button: true, links: regions.map((r) => [r.name, r.URL]) },
  { label: 'Insights', to: '/insights/', links: [['Insights', '/insights/'], ['Glossary', '/insights/glossary/']] },
  { label: 'Company', button: true, links: [['About', '/about/'], ['Events', '/events/'], ['Contact', '/contact/']] },
];
const navHtml = () => `<nav class="site-nav" id="site-nav" aria-label="Main"><ul class="nav-list">${NAV.map((n) => {
  const cur = n.to && (CUR === n.to || CUR.startsWith(n.to)) ? ' aria-current="page"' : '';
  const head = n.button ? `<button class="nav-link" type="button" aria-expanded="false" aria-haspopup="true">${n.label}</button>` : `<a class="nav-link" href="${href(n.to)}"${cur}>${n.label}</a>`;
  const items = n.links.map(([l, u]) => `<li><a href="${href(u)}">${esc(l)}</a></li>`).join('') + (n.all ? `<li class="all"><a href="${href(n.all[1])}">${n.all[0]} →</a></li>` : '');
  return `<li class="nav-item${n.wide ? ' wide' : ''}">${head}<div class="nav-panel"><ul>${items}</ul></div></li>`;
}).join('')}</ul><div class="nav-sheet-cta"><a class="btn btn-secondary" href="${href('/partners/portal/')}">Partner login</a><a class="btn btn-primary" href="${href('/contact/')}">Request a briefing</a></div></nav>`;

const LOGO = () => `<a class="logo" href="${href('/')}" aria-label="Evanssion home"><img class="logo-mark" src="${asset('mark.png')}" alt="" width="41" height="38"><span class="logo-word" aria-hidden="true"></span></a>`;
const header = () => `<a class="skip" href="#main">Skip to content</a>
<div class="site-header"><div class="wrap bar">
${LOGO()}
${navHtml()}
<div class="bar-end">
<a class="text-link hide-sm" href="${href('/partners/portal/')}">Partner login</a>
<a class="btn btn-primary btn-sm hide-sm" href="${href('/contact/')}">Request a briefing</a>
<button class="icon-btn" id="theme-toggle" type="button" aria-label="Switch theme"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg></button>
<button class="icon-btn menu-btn" id="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 8h16M4 16h16"/></svg></button>
</div></div></div>`;

const col = (title, items) => `<div><h2>${title}</h2><ul>${items.map(([l, u]) => `<li><a href="${href(u)}">${esc(l)}</a></li>`).join('')}</ul></div>`;
const footer = () => `<footer class="site-footer"><div class="wrap"><div class="foot-grid">
<div class="foot-brand">${LOGO()}<p>Your trusted cybersecurity and AI distribution partner. GCC, UAE, MEA.</p><p><a href="mailto:sales@evanssion.com">sales@evanssion.com</a><br><a href="tel:+971586061121">+971 58 606 1121</a><br>${esc(ADDRESS)}</p><p><a href="${LINKEDIN}" target="_blank" rel="noopener">LinkedIn</a></p></div>
${col('Vendors', vendors.map((v) => [v.name, v.URL]))}
${col('Solutions', solutions.map((s) => [s.name, s.URL]))}
${col('Partners', [['Partner programme', '/partners/'], ['Become a partner', '/partners/become-a-partner/'], ['Our partners', '/partners/our-partners/'], ['Partner portal', '/partners/portal/']])}
${col('Regions', regions.map((r) => [r.name, r.URL]))}
${col('Company', [['About', '/about/'], ['Insights', '/insights/'], ['Glossary', '/insights/glossary/'], ['Events', '/events/'], ['Contact', '/contact/'], ['Become a vendor', '/vendors/become-a-vendor/']])}
</div><div class="foot-base"><p>© ${new Date().getFullYear()} Evanssion FZCO, Dubai, UAE.</p><ul><li><a href="${href('/privacy/')}">Privacy notice</a></li><li><a href="${href('/terms/')}">Terms</a></li><li><button class="linklike" type="button" id="cookie-settings">Cookie settings</button></li></ul></div></div></footer>
<div class="consent" id="consent" role="region" aria-label="Cookie consent" hidden><p>We use essential cookies to run this site and, with your consent, analytics cookies to improve it.</p><div class="actions"><button class="btn btn-secondary btn-sm" data-choice="reject" type="button">Reject non-essential</button><button class="btn btn-primary btn-sm" data-choice="accept" type="button">Accept</button></div></div>`;

function crumbs(p) {
  if (p.URL === '/' || p.noindex) return [];
  const segs = p.URL.split('/').filter(Boolean);
  const trail = [{ name: 'Home', url: '/' }];
  let acc = '';
  segs.forEach((s, i) => {
    acc += '/' + s; const url = acc + '/';
    const pg = byUrl[url];
    if (pg) trail.push({ name: i === segs.length - 1 ? p.name : ({ '/vendors/': 'Vendors', '/solutions/': 'Solutions', '/partners/': 'Partners', '/insights/': 'Insights' }[url] || pg.name), url });
  });
  return trail;
}
const crumbHtml = (trail) => trail.length < 2 ? '' : `<nav class="crumbs" aria-label="Breadcrumb"><div class="wrap"><ol>${trail.map((c, i) => i === trail.length - 1 ? `<li aria-current="page">${esc(c.name)}</li>` : `<li><a href="${href(c.url)}">${esc(c.name)}</a></li>`).join('')}</ol></div></nav>`;

function jsonld(p, trail, type) {
  const org = { '@type': 'Organization', '@id': ORIGIN + '/#org', name: 'Evanssion FZCO', alternateName: 'Evanssion', url: ORIGIN + '/', logo: ORIGIN + '/assets/mark.png', email: 'sales@evanssion.com', telephone: '+971586061121',
    address: { '@type': 'PostalAddress', streetAddress: '201, Techno Hub 2, Dubai Silicon Oasis', addressLocality: 'Dubai', addressCountry: 'AE' }, sameAs: [LINKEDIN],
    areaServed: ['United Arab Emirates', 'Saudi Arabia', 'Bahrain', 'Middle East', 'Africa'], openingHours: 'Mo-Fr 09:00-18:00',
    contactPoint: [{ '@type': 'ContactPoint', contactType: 'sales', email: 'sales@evanssion.com', telephone: '+971586061121', areaServed: ['AE', 'SA', 'BH'], availableLanguage: ['English'] }] };
  const g = [org, { '@type': 'WebSite', '@id': ORIGIN + '/#site', url: ORIGIN + '/', name: 'Evanssion', publisher: { '@id': ORIGIN + '/#org' }, inLanguage: 'en' }];
  if (!p.noindex) {
    const pageType = { about: 'AboutPage', contact: 'ContactPage', vendorHub: 'CollectionPage', solutionHub: 'CollectionPage', insights: 'CollectionPage', glossary: 'CollectionPage', events: 'CollectionPage', partnerDir: 'CollectionPage' }[type] || 'WebPage';
    const node = { '@type': pageType, '@id': ORIGIN + p.URL + '#page', url: ORIGIN + p.URL, name: p.spec['Title tag'], description: p.spec['Meta description'], isPartOf: { '@id': ORIGIN + '/#site' }, about: { '@id': ORIGIN + '/#org' }, inLanguage: 'en' };
    const list = (items) => ({ '@type': 'ItemList', itemListElement: items.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.name, url: ORIGIN + x.URL })) });
    if (type === 'vendorHub') node.mainEntity = list(vendors);
    if (type === 'solutionHub') node.mainEntity = list(solutions);
    if (type === 'glossary') node.mainEntity = { '@type': 'DefinedTermSet', '@id': ORIGIN + p.URL + '#terms', name: 'Cybersecurity and AI security glossary', hasDefinedTerm: terms.map((t) => ({ '@type': 'DefinedTerm', name: t.term, description: t.def, url: ORIGIN + t.URL, inDefinedTermSet: ORIGIN + p.URL + '#terms' })) };
    g.push(node);
    if (type === 'term') g.push({ '@type': 'DefinedTerm', '@id': ORIGIN + p.URL + '#term', name: p.glossTerm.term, description: p.glossTerm.def, url: ORIGIN + p.URL, inDefinedTermSet: ORIGIN + '/insights/glossary/' });
    if (type === 'vendor') {
      const m = vendorMeta[p.name.toLowerCase()] || {};
      g.push({ '@type': 'Organization', '@id': ORIGIN + p.URL + '#vendor', name: p.name, logo: ORIGIN + '/assets/img/vendors/' + slugOf(p.URL) + '.png' }, { '@type': 'Service', '@id': ORIGIN + p.URL + '#service', name: `${p.name} distribution in the Middle East and Africa`, serviceType: m.what, provider: { '@id': ORIGIN + '/#org' }, brand: { '@id': ORIGIN + p.URL + '#vendor' }, areaServed: ['United Arab Emirates', 'Saudi Arabia', 'Bahrain', 'Middle East', 'Africa'] });
    }
    if (type === 'region') g.push({ '@type': 'Service', name: p.spec.H1, provider: { '@id': ORIGIN + '/#org' }, areaServed: { '@type': 'Country', name: p.name === 'Africa and wider MEA' ? 'Africa' : p.name } });
    const faq = p.sections.flatMap((s) => s.blocks).find((b) => b.t === 'faq');
    if (faq) g.push({ '@type': 'FAQPage', mainEntity: faq.items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });
  }
  if (trail.length > 1) g.push({ '@type': 'BreadcrumbList', itemListElement: trail.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: ORIGIN + c.url })) });
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': g })}</script>`;
}

function render(p) {
  CUR = p.URL;
  const type = typeOf(p);
  const trail = crumbs(p);
  const body = T[type](p);
  const title = p.spec['Title tag'], desc = p.noindex ? '' : p.spec['Meta description'];
  if (title.length > 60) warn.push(`title ${title.length}: ${p.URL}`);
  if (desc.length > 160) warn.push(`meta ${desc.length}: ${p.URL}`);
  const faqCount = (p.sections.flatMap((s) => s.blocks).find((b) => b.t === 'faq') || { items: [] }).items.length;
  p.faqCount = faqCount;
  return `<!doctype html>
<html lang="en" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${p.noindex ? '<meta name="robots" content="noindex, follow">' : '<meta name="robots" content="index, follow, max-image-preview:large">'}
${p.noindex ? '' : `<link rel="canonical" href="${ORIGIN}${p.URL}">`}
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0A0B0E" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="website"><meta property="og:site_name" content="Evanssion"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${ORIGIN}${p.URL}"><meta property="og:image" content="${ORIGIN}/assets/og.png">
<meta name="twitter:card" content="summary_large_image">
<script>try{var t=localStorage.getItem('evanssion-theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
<link rel="icon" type="image/png" href="${asset('mark.png')}">
<link rel="stylesheet" href="${asset('site.css')}">
${jsonld(p, trail, type)}
</head>
<body data-thanks="${PROD ? '/thank-you/' : pre() + 'thank-you/index.html'}">
${header()}
${crumbHtml(trail)}
<main id="main">
${body}
</main>
${footer()}
<script src="${asset('site.js')}" defer></script>
</body>
</html>
`;
}

/* ------------------------------------------------------------------ write */
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, 'assets'), { recursive: true });
const wm = 'data:image/png;base64,' + fs.readFileSync(path.join(SRC, 'wordmark.png')).toString('base64'); // inlined so the CSS mask also works from file://
fs.writeFileSync(path.join(DIST, 'assets/site.css'), fs.readFileSync(path.join(SRC, 'site.css'), 'utf8').replace('/*TOKENS*/', TOKENS).split('url(wordmark.png)').join(`url(${wm})`));
fs.copyFileSync(path.join(SRC, 'site.js'), path.join(DIST, 'assets/site.js'));
fs.cpSync(path.join(SRC, 'img'), path.join(DIST, 'assets/img'), { recursive: true });
for (const f of ['mark.png', 'og.png']) fs.copyFileSync(path.join(SRC, f), path.join(DIST, 'assets', f));
for (const p of pages) {
  const out = path.join(DIST, fileOf(p.URL));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, render(p));
}
const indexable = pages.filter((p) => !p.noindex);
const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexable.map((p) => `  <url><loc>${ORIGIN}${p.URL}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /thank-you/\n\n# AI crawlers are welcome\nUser-agent: GPTBot\nAllow: /\nUser-agent: ClaudeBot\nAllow: /\nUser-agent: PerplexityBot\nAllow: /\nUser-agent: Google-Extended\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`);
fs.writeFileSync(path.join(DIST, 'llms.txt'), `# Evanssion\n\n> Evanssion is a Dubai-based value-added distributor of cybersecurity and AI security solutions, serving partners and enterprises in the UAE, Saudi Arabia, Bahrain and across the Middle East and Africa.\n\n## Key pages\n- [Vendors](${ORIGIN}/vendors/): the ${vendors.length} vendors we distribute\n- [Solutions](${ORIGIN}/solutions/): security solutions by problem\n- [Partners](${ORIGIN}/partners/): the partner programme\n- [Regions](${ORIGIN}/regions/uae/): UAE, Saudi Arabia, Bahrain, Africa and wider MEA\n- [Glossary](${ORIGIN}/insights/glossary/): definitions of security and AI security terms\n- [Contact](${ORIGIN}/contact/)\n\n## Vendors\n${vendors.map((v) => `- [${v.name}](${ORIGIN}${v.URL}): ${(vendorMeta[v.name.toLowerCase()] || {}).what || ''}`).join('\n')}\n\n## Solutions\n${solutions.map((s) => `- [${s.name}](${ORIGIN}${s.URL})`).join('\n')}\n`);
console.log(`${pages.length} pages + sitemap, robots, llms.txt -> ${DIST} (${PROD ? 'prod' : 'preview'} links)`);
if (warn.length) console.log('WARN', warn);
