(function () {
  var root = document.documentElement;
  root.classList.remove('no-js'); root.classList.add('js');
  var KEY = 'evanssion-theme';
  var mq = window.matchMedia('(prefers-color-scheme: dark)');
  var themeBtn = document.getElementById('theme-toggle');
  function current() { return root.getAttribute('data-theme') || (mq.matches ? 'dark' : 'light'); }
  function label() {
    if (!themeBtn) return;
    var next = current() === 'dark' ? 'light' : 'dark';
    themeBtn.setAttribute('aria-label', 'Switch to ' + next + ' theme');
    themeBtn.setAttribute('title', 'Switch to ' + next + ' theme');
  }
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem(KEY, next); } catch (e) {}
      label();
    });
    if (mq.addEventListener) mq.addEventListener('change', label);
    label();
  }

  var menuBtn = document.getElementById('menu-toggle');
  var nav = document.getElementById('site-nav');
  if (menuBtn && nav) {
    menuBtn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      document.body.style.overflow = open ? 'hidden' : '';
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (nav.classList.contains('open')) { nav.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); menuBtn.focus(); document.body.style.overflow = ''; }
        document.querySelectorAll('.nav-link[aria-expanded="true"]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
      }
    });
  }
  document.querySelectorAll('button.nav-link[aria-expanded]').forEach(function (b) {
    b.addEventListener('click', function () { b.setAttribute('aria-expanded', String(b.getAttribute('aria-expanded') !== 'true')); });
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.nav-item')) document.querySelectorAll('.nav-link[aria-expanded="true"]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
  });

  var consent = document.getElementById('consent');
  if (consent) {
    var seen = false;
    try { seen = !!localStorage.getItem('evanssion-consent'); } catch (e) {}
    consent.hidden = seen;
    consent.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        try { localStorage.setItem('evanssion-consent', b.dataset.choice); } catch (e) {}
        consent.hidden = true;
      });
    });
  }
  var cs = document.getElementById('cookie-settings');
  if (cs && consent) cs.addEventListener('click', function () { consent.hidden = false; });

  /* vendor filter chips */
  document.querySelectorAll('.chips[data-filter]').forEach(function (bar) {
    var grid = bar.parentNode.querySelector('.filterable');
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      bar.querySelectorAll('.chip').forEach(function (c) { c.setAttribute('aria-pressed', String(c === b)); });
      grid.querySelectorAll('[data-group]').forEach(function (card) { card.hidden = !!b.dataset.g && card.dataset.group !== b.dataset.g; });
    });
  });

  /* contact form: enquiry type switches the fields */
  var cf = document.getElementById('contact-form');
  if (cf) {
    var params = new URLSearchParams(location.search), want = params.get('type');
    var radios = cf.querySelectorAll('input[name="enquiry"]');
    function sync() {
      var v = cf.querySelector('input[name="enquiry"]:checked').value;
      cf.dataset.type = v;
      cf.querySelectorAll('.type-fields').forEach(function (d) {
        var on = d.dataset.for === v; d.classList.toggle('on', on);
        d.querySelectorAll('input,select,textarea').forEach(function (el) { el.disabled = !on; });
      });
    }
    radios.forEach(function (r) { if (r.value === want) r.checked = true; r.addEventListener('change', sync); });
    sync();
  }

  /* Cloudflare Turnstile (bot check): the script is loaded only when someone starts using a form, so it costs normal page views nothing */
  var tsKey = document.body.dataset.ts || '', tsState = 0, tsQueue = [];
  function tsReady() { tsState = 2; tsQueue.splice(0).forEach(function (fn) { fn(); }); }
  function tsLoad(fn) {
    if (!tsKey) return;
    if (tsState === 2) return fn();
    tsQueue.push(fn);
    if (tsState === 1) return;
    tsState = 1;
    var s = document.createElement('script'); s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.async = true; s.onload = tsReady; document.head.appendChild(s);
  }
  document.querySelectorAll('form[data-lead]').forEach(function (f) {
    var slot = f.querySelector('.ts-slot'); if (!slot || !tsKey) return;
    f.addEventListener('focusin', function once() {
      f.removeEventListener('focusin', once);
      tsLoad(function () { f.__tsId = window.turnstile.render(slot, { sitekey: tsKey, size: 'flexible', theme: 'auto' }); });
    });
  });

  /* lead forms post JSON to /api/lead; fall back to a ready-made email if the endpoint is not there */
  document.querySelectorAll('form[data-lead]').forEach(function (f) {
    var msg = f.querySelector('.form-msg');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!f.checkValidity()) { f.reportValidity(); return; }
      var fd = new FormData(f), body = { type: f.dataset.type, page: location.pathname, fields: {} };
      fd.forEach(function (v, k) { if (k === 'website_url') { body.hp = v; return; } if (k === 'cf-turnstile-response') { body.cf = v; return; } if (body.fields[k] !== undefined) body.fields[k] = [].concat(body.fields[k], v); else body.fields[k] = v; });
      var btn = f.querySelector('button[type="submit"]'); btn.disabled = true; msg.className = 'form-msg'; msg.textContent = 'Sending…';
      if (tsKey && !body.cf) { btn.disabled = false; msg.className = 'form-msg err'; msg.textContent = 'Please wait a moment while we verify you are human, then press the button again.'; return; }
      fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json().catch(function () { return {}; }); })
        .then(function () { location.href = document.body.dataset.thanks || '/thank-you/'; })
        .catch(function () {
          var lines = Object.keys(body.fields).map(function (k) { return k + ': ' + [].concat(body.fields[k]).join(', '); }).join('\n');
          var link = 'mailto:sales@evanssion.com?subject=' + encodeURIComponent('Website enquiry: ' + body.type) + '&body=' + encodeURIComponent(lines);
          msg.className = 'form-msg err'; msg.innerHTML = 'We could not send this form from here. <a href="' + link + '">Email it to sales@evanssion.com</a> instead.';
          btn.disabled = false;
          if (window.turnstile && f.__tsId !== undefined) { try { window.turnstile.reset(f.__tsId); } catch (x) {} }
        });
    });
  });

  /* site search: loads the index on first open, filters as you type */
  (function () {
    var btn = document.getElementById('search-toggle'), box = document.getElementById('search');
    if (!btn || !box) return;
    var input = document.getElementById('search-input'), list = document.getElementById('search-results'),
        status = document.getElementById('search-status'), closeBtn = document.getElementById('search-close');
    var data = null, loading = false, root = btn.getAttribute('data-root') || '/';
    function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function reEsc(t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
    function load(cb) {
      if (data) return cb();
      if (loading) return;
      loading = true;
      status.textContent = 'Loading search';
      fetch(btn.getAttribute('data-index')).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) { data = j; loading = false; status.textContent = ''; cb(); })
        .catch(function () { loading = false; status.textContent = 'Search is unavailable right now. Please browse the menu instead.'; });
    }
    function snippet(text, terms) {
      var low = text.toLowerCase(), at = -1, i;
      for (i = 0; i < terms.length; i++) { at = low.indexOf(terms[i]); if (at > -1) break; }
      if (at < 0) return text.slice(0, 140);
      var s = Math.max(0, at - 50), e = Math.min(text.length, at + 100);
      return (s > 0 ? '...' : '') + text.slice(s, e) + (e < text.length ? '...' : '');
    }
    function run() {
      var q = input.value.trim().toLowerCase();
      list.innerHTML = '';
      if (q.length < 2) { status.textContent = q ? 'Keep typing' : 'Type to search vendors, solutions and articles.'; return; }
      var terms = q.split(/\s+/).filter(Boolean), hits = [];
      data.forEach(function (d) {
        var t = d.t.toLowerCase(), de = d.d.toLowerCase(), x = d.x.toLowerCase(), score = 0, ok = true;
        terms.forEach(function (w) {
          var s = 0;
          if (t.indexOf(w) > -1) s += 10 + (t.indexOf(w) === 0 ? 3 : 0);
          if (de.indexOf(w) > -1) s += 4;
          if (x.indexOf(w) > -1) s += 1;
          if (!s) ok = false; score += s;
        });
        if (ok && /^(Service|Vendor|Solution|Region|Partners)$/.test(d.k)) score += 3;
        if (ok) hits.push({ d: d, s: score });
      });
      hits.sort(function (a, b) { return b.s - a.s; });
      status.textContent = hits.length ? hits.length + (hits.length === 1 ? ' result' : ' results') : 'No results for "' + input.value.trim() + '". Try a vendor, a solution or a topic.';
      var re = new RegExp('(' + terms.map(reEsc).join('|') + ')', 'ig');
      hits.slice(0, 12).forEach(function (h) {
        var li = document.createElement('li');
        li.innerHTML = '<a href="' + root + h.d.u.replace(/^\//, '') + (root !== '/' ? 'index.html' : '') + '"><span class="sr-kind">' + esc(h.d.k) + '</span><span class="sr-title">' + esc(h.d.t).replace(re, '<mark>$1</mark>') + '</span><span class="sr-snip">' + esc(snippet(h.d.d + ' ' + h.d.x, terms)).replace(re, '<mark>$1</mark>') + '</span></a>';
        list.appendChild(li);
      });
    }
    var lastFocus = null;
    function open() {
      lastFocus = document.activeElement;
      box.hidden = false; btn.setAttribute('aria-expanded', 'true'); document.body.style.overflow = 'hidden';
      input.focus();
      load(run);
    }
    function close() {
      box.hidden = true; btn.setAttribute('aria-expanded', 'false'); document.body.style.overflow = '';
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    btn.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
    input.addEventListener('input', function () { if (data) run(); });
    input.closest('form').addEventListener('submit', function (e) { e.preventDefault(); var a = list.querySelector('a'); if (a) a.click(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !box.hidden) { e.stopPropagation(); close(); }
      if (e.key === 'Tab' && !box.hidden) {
        var f = box.querySelectorAll('input, button, a[href]'); if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  })();
})();
