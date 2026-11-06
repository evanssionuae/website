#!/usr/bin/env node
/* Tells Bing, Yandex and other IndexNow search engines which pages are new or changed.
   Run after a deploy has finished:
     node tools/indexnow.js                 submits every page in the live sitemap
     node tools/indexnow.js URL [URL ...]   submits only the pages you list
   The key comes from the src/<32 hex characters>.txt file, which the site serves at its root. */
const fs = require('fs'), path = require('path');
const SRC = path.resolve(__dirname, '../src');
const HOST = 'www.evanssion.com';
const keyFile = fs.readdirSync(SRC).find((f) => /^[a-f0-9]{32}\.txt$/.test(f));
if (!keyFile) { console.error('No key file found in src/'); process.exit(1); }
const key = keyFile.replace('.txt', '');
(async () => {
  let urls = process.argv.slice(2);
  if (!urls.length) {
    const r = await fetch(`https://${HOST}/sitemap.xml`);
    if (!r.ok) { console.error('Could not read the live sitemap:', r.status); process.exit(1); }
    urls = [...(await r.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  }
  urls = urls.filter((u) => new URL(u).host === HOST);
  if (!urls.length) { console.error('No URLs to submit'); process.exit(1); }
  const check = await fetch(`https://${HOST}/${key}.txt`);
  if (!check.ok || (await check.text()).trim() !== key) { console.error(`The key file is not live yet at https://${HOST}/${key}.txt. Deploy first, then run this again.`); process.exit(1); }
  const res = await fetch('https://api.indexnow.org/IndexNow', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key, keyLocation: `https://${HOST}/${key}.txt`, urlList: urls.slice(0, 10000) }),
  });
  console.log(`Submitted ${Math.min(urls.length, 10000)} URLs. Response: ${res.status} ${res.statusText}`);
  console.log({ 200: 'OK: received.', 202: 'Accepted: received, key validation pending.', 400: 'Invalid format.', 403: 'Key not valid or key file not found.', 422: 'URLs do not belong to the host, or key mismatch.', 429: 'Too many requests.' }[res.status] || '');
})();
