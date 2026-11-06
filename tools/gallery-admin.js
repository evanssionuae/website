#!/usr/bin/env node
/* Evanssion gallery manager. Run from the website folder:  node tools/gallery-admin.js
   Opens a page on this computer only (http://localhost:4747) to add, edit and delete gallery photos.
   Photos are resized in the browser (full 1600px and thumbnail 800px, JPEG) and saved to
   src/img/gallery/, with the captions in src/gallery/gallery.json. Then commit and push as usual.
   No packages to install. */
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const IMG = path.join(ROOT, 'src/img/gallery'), DATA = path.join(ROOT, 'src/gallery/gallery.json');
const PORT = 4747;
fs.mkdirSync(IMG, { recursive: true }); fs.mkdirSync(path.dirname(DATA), { recursive: true });
if (!fs.existsSync(DATA)) fs.writeFileSync(DATA, '[]\n');
const read = () => { try { return JSON.parse(fs.readFileSync(DATA, 'utf8')); } catch (e) { return []; } };
const write = (a) => fs.writeFileSync(DATA, JSON.stringify(a, null, 1) + '\n');
const send = (res, code, body, type = 'application/json') => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
const body = (req) => new Promise((ok, no) => { const c = []; let n = 0; req.on('data', (d) => { n += d.length; if (n > 30e6) { no(new Error('Too large')); req.destroy(); } else c.push(d); }); req.on('end', () => { try { ok(JSON.parse(Buffer.concat(c).toString() || '{}')); } catch (e) { no(e); } }); });
const b64 = (s) => Buffer.from(String(s).replace(/^data:image\/jpeg;base64,/, ''), 'base64');
const isJpeg = (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8;
const cleanDate = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : '');

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://localhost');
    if (req.headers.host && !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host)) return send(res, 403, 'Forbidden', 'text/plain');
    if (req.method === 'GET' && u.pathname === '/') return send(res, 200, PAGE, 'text/html; charset=utf-8');
    if (req.method === 'GET' && u.pathname === '/api/list') return send(res, 200, read());
    const m = u.pathname.match(/^\/img\/([a-z0-9-]+)\.jpg$/);
    if (req.method === 'GET' && m) { const f = path.join(IMG, m[1] + '.jpg'); return fs.existsSync(f) ? send(res, 200, fs.readFileSync(f), 'image/jpeg') : send(res, 404, 'Not found', 'text/plain'); }
    if (req.method === 'POST' && u.pathname === '/api/add') {
      const d = await body(req); const full = b64(d.full), sm = b64(d.sm);
      if (!isJpeg(full) || !isJpeg(sm)) return send(res, 400, { error: 'Not a JPEG' });
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      fs.writeFileSync(path.join(IMG, id + '.jpg'), full); fs.writeFileSync(path.join(IMG, id + '-sm.jpg'), sm);
      const a = read(); a.push({ id, caption: String(d.caption || '').slice(0, 1000), date: cleanDate(d.date), alt: String(d.alt || '').slice(0, 300), sw: +d.sw || 800, sh: +d.sh || 600 }); write(a);
      return send(res, 200, { ok: true, id });
    }
    if (req.method === 'POST' && u.pathname === '/api/update') {
      const d = await body(req); const a = read(), g = a.find((x) => x.id === d.id); if (!g) return send(res, 404, { error: 'Not found' });
      g.caption = String(d.caption || '').slice(0, 1000); g.date = cleanDate(d.date); write(a); return send(res, 200, { ok: true });
    }
    if (req.method === 'POST' && u.pathname === '/api/delete') {
      const d = await body(req); const a = read(), i = a.findIndex((x) => x.id === d.id); if (i < 0) return send(res, 404, { error: 'Not found' });
      for (const s of ['.jpg', '-sm.jpg']) try { fs.unlinkSync(path.join(IMG, a[i].id + s)); } catch (e) {}
      a.splice(i, 1); write(a); return send(res, 200, { ok: true });
    }
    send(res, 404, 'Not found', 'text/plain');
  } catch (e) { send(res, 500, { error: String(e.message || e) }); }
});
server.listen(PORT, '127.0.0.1', () => console.log(`Gallery manager running: open http://localhost:${PORT}\nPress Ctrl+C to stop.`));

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Evanssion gallery manager</title>
<style>
:root{--bg:#f6f6f8;--card:#fff;--fg:#1d1d22;--mut:#666;--acc:#c0390a;--line:#dcdce2}
@media(prefers-color-scheme:dark){:root{--bg:#16161a;--card:#202026;--fg:#f0f0f3;--mut:#a0a0aa;--line:#34343c}}
*{box-sizing:border-box}body{margin:0;font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;background:var(--bg);color:var(--fg)}
main{max-width:1000px;margin:0 auto;padding:24px 16px 80px}h1{margin:0 0 4px;font-size:1.6rem}h2{font-size:1.15rem;margin:0 0 12px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px;margin:20px 0}
label{display:block;font-weight:600;margin:14px 0 4px}.opt{font-weight:400;color:var(--mut)}
input[type=text],input[type=date],input[type=url],textarea{width:100%;padding:10px;border:1px solid var(--line);border-radius:8px;font:inherit;background:var(--bg);color:var(--fg)}
textarea{min-height:90px;resize:vertical}button{font:inherit;font-weight:600;padding:10px 16px;border-radius:999px;border:0;background:var(--acc);color:#fff;cursor:pointer}
button.sec{background:transparent;color:var(--fg);border:1px solid var(--line)}button.danger{background:transparent;color:#c0262d;border:1px solid var(--line)}button:disabled{opacity:.5;cursor:default}
.drop{border:2px dashed var(--line);border-radius:12px;padding:28px;text-align:center;color:var(--mut);cursor:pointer}.drop.on{border-color:var(--acc)}
.prev{display:flex;gap:16px;align-items:flex-start;margin-top:14px;flex-wrap:wrap}.prev img{width:220px;max-width:100%;border-radius:10px;display:block}
.row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;align-items:center}.msg{margin-top:10px;font-weight:600}.ok{color:#1c7c3a}.err{color:#c0262d}
.list{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px}.it{border:1px solid var(--line);border-radius:12px;padding:12px;background:var(--card)}.it img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px;display:block}
.small{font-size:.85rem;color:var(--mut)}.pv{background:var(--bg);border-radius:8px;padding:8px 10px;margin-top:8px;font-size:.9rem}.pv a{color:var(--acc)}
.note{background:var(--bg);border-left:4px solid var(--acc);padding:10px 14px;border-radius:6px;margin-top:12px}
</style></head><body><main>
<h1>Evanssion gallery manager</h1><p class="small">Runs on this computer only. Photos are resized here, then saved into the website folder. Afterwards commit and push in GitHub Desktop.</p>
<div class="card"><h2>Add a photo</h2>
<div class="drop" id="drop">Drop a photo here, or click to choose<input id="file" type="file" accept="image/*" hidden></div>
<div class="prev" id="prev" hidden><img id="pimg" alt=""><div class="small" id="pinfo"></div></div>
<label for="cap">Text under the photo</label><textarea id="cap" placeholder="Evanssion team with Jane Doe of Vendor at the partner briefing in Dubai"></textarea>
<div class="row"><button class="sec" type="button" id="lnk">Link a person to LinkedIn</button><span class="small">Select the name in the text first, then click, then paste the LinkedIn address.</span></div>
<div class="pv" id="pv"></div>
<label for="dt">Date <span class="opt">(optional)</span></label><input id="dt" type="date" style="max-width:220px">
<div class="note small">Publish photos of people only with their agreement, and take a photo down if someone asks.</div>
<div class="row"><button type="button" id="add" disabled>Add to gallery</button></div><div class="msg" id="msg"></div></div>
<div class="card"><h2>Photos in the gallery (<span id="cnt">0</span>)</h2><p class="small">The website shows 18 photos a page, newest date first, and adds pages automatically.</p><div class="list" id="list"></div></div>
</main><script>
const $=id=>document.getElementById(id);let cur=null;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=t=>esc(t).replace(/\\[([^\\]]+)\\]\\((https:\\/\\/[^\\s)]+)\\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
const drop=$('drop'),file=$('file');drop.onclick=()=>file.click();
['dragover','dragenter'].forEach(e=>drop.addEventListener(e,x=>{x.preventDefault();drop.classList.add('on')}));
['dragleave','drop'].forEach(e=>drop.addEventListener(e,x=>{x.preventDefault();drop.classList.remove('on')}));
drop.addEventListener('drop',x=>{if(x.dataTransfer.files[0])pick(x.dataTransfer.files[0])});file.onchange=()=>file.files[0]&&pick(file.files[0]);
async function resize(bmp,max,q){const s=Math.min(1,max/Math.max(bmp.width,bmp.height));const w=Math.round(bmp.width*s),h=Math.round(bmp.height*s);const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.imageSmoothingQuality='high';x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(bmp,0,0,w,h);return{url:c.toDataURL('image/jpeg',q),w,h}}
async function pick(f){$('msg').textContent='';try{const bmp=await createImageBitmap(f,{imageOrientation:'from-image'});const full=await resize(bmp,1600,.82),sm=await resize(bmp,800,.8);cur={full:full.url,sm:sm.url,sw:sm.w,sh:sm.h};
$('pimg').src=sm.url;$('prev').hidden=false;const kb=u=>Math.round(u.length*.75/1024);$('pinfo').textContent='Original '+Math.round(f.size/1024)+' KB. Optimised: full '+full.w+'x'+full.h+' ('+kb(full.url)+' KB), thumbnail '+sm.w+'x'+sm.h+' ('+kb(sm.url)+' KB).';$('add').disabled=false}catch(e){$('msg').className='msg err';$('msg').textContent='Could not read that image. Try a JPEG or PNG.'}}
$('cap').oninput=()=>$('pv').innerHTML=fmt($('cap').value)||'<span class="small">Preview of the text appears here</span>';$('cap').oninput();
$('lnk').onclick=()=>{const t=$('cap');const a=t.selectionStart,b=t.selectionEnd;if(a===b){alert('Select the person\\'s name in the text first.');return}const u=prompt('Paste the LinkedIn profile address (starts with https://)');if(!u)return;if(!/^https:\\/\\/[^\\s)]+$/.test(u.trim())){alert('The address must start with https:// and contain no spaces.');return}t.value=t.value.slice(0,a)+'['+t.value.slice(a,b)+']('+u.trim()+')'+t.value.slice(b);t.oninput()};
$('add').onclick=async()=>{if(!cur)return;$('add').disabled=true;$('msg').className='msg';$('msg').textContent='Saving...';
const r=await fetch('/api/add',{method:'POST',body:JSON.stringify({...cur,caption:$('cap').value.trim(),date:$('dt').value})});const j=await r.json();
if(!r.ok){$('msg').className='msg err';$('msg').textContent=j.error||'Failed';$('add').disabled=false;return}
$('msg').className='msg ok';$('msg').textContent='Added. Add another, or commit and push in GitHub Desktop.';cur=null;$('prev').hidden=true;$('cap').value='';$('dt').value='';file.value='';$('cap').oninput();load()};
async function load(){const a=await (await fetch('/api/list')).json();$('cnt').textContent=a.length;const s=[...a].sort((x,y)=>(y.date||'').localeCompare(x.date||''));
$('list').innerHTML=s.map(g=>'<div class="it" data-id="'+g.id+'"><img src="/img/'+g.id+'-sm.jpg" alt=""><label>Text</label><textarea>'+esc(g.caption)+'</textarea><label>Date <span class="opt">(optional)</span></label><input type="date" value="'+(g.date||'')+'"><div class="row"><button class="sec" data-a="save">Save</button><button class="danger" data-a="del">Delete</button><span class="small"></span></div></div>').join('')||'<p class="small">No photos yet.</p>'}
$('list').onclick=async e=>{const b=e.target.closest('button');if(!b)return;const it=b.closest('.it'),id=it.dataset.id,st=it.querySelector('.row .small');
if(b.dataset.a==='save'){const r=await fetch('/api/update',{method:'POST',body:JSON.stringify({id,caption:it.querySelector('textarea').value.trim(),date:it.querySelector('input').value})});st.textContent=r.ok?'Saved':'Failed'}
if(b.dataset.a==='del'){if(b.dataset.s!=='1'){b.dataset.s='1';b.textContent='Click again to delete';setTimeout(()=>{b.dataset.s='';b.textContent='Delete'},4000);return}await fetch('/api/delete',{method:'POST',body:JSON.stringify({id})});load()}};
load();
</script></body></html>`;
