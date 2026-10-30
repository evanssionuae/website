// Cloudflare Pages Function: POST /api/lead
// Environment variables (Pages > Settings > Variables and Secrets):
//   RESEND_API_KEY  API key from resend.com (or swap sendMail() for your provider)
//   LEAD_FROM       verified sender, e.g. "Evanssion Website <website@evanssion.com>"
//   LEAD_TO         default inbox, e.g. sales@evanssion.com
//   LEAD_TO_PARTNER / LEAD_TO_VENDOR / LEAD_TO_ENTERPRISE  optional per-type inboxes
//   TURNSTILE_SECRET  Cloudflare Turnstile secret key (the public site key goes in TURNSTILE_SITEKEY, read at build time)
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });

// GET /api/lead reports which settings are present (never their values) so setup can be checked in a browser
export async function onRequestGet({ env }) {
  return json({ function: 'running', RESEND_API_KEY: !!env.RESEND_API_KEY, LEAD_FROM: !!env.LEAD_FROM, LEAD_TO: !!env.LEAD_TO });
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid request' }, 400); }
  if (body.hp) return json({ ok: true }); // honeypot filled: pretend success
  const f = body.fields || {};
  const email = String(f.email || f['c-email'] || f['a-email'] || '');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'A valid email is required' }, 400);

  /* Cloudflare Turnstile: enforced once TURNSTILE_SECRET is set in Pages > Settings > Variables and secrets */
  if (env.TURNSTILE_SECRET) {
    const token = String(body.cf || '');
    if (!token) return json({ error: 'Verification required' }, 400);
    const v = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: request.headers.get('CF-Connecting-IP') || '' }),
    });
    const r = await v.json().catch(() => ({}));
    if (!r.success) return json({ error: 'Verification failed' }, 400);
  }

  const type = String(body.type || 'enquiry');
  const to = env['LEAD_TO_' + type.toUpperCase().replace(/-.*/, '')] || env.LEAD_TO;
  if (!env.RESEND_API_KEY || !to) return json({ error: 'Not configured' }, 500);

  const lines = Object.entries(f).map(([k, v]) => `${k}: ${[].concat(v).join(', ')}`).join('\n');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.LEAD_FROM, to: [to], reply_to: email, subject: `Website ${type}: ${f['c-company'] || f['a-company'] || email}`, text: `${lines}\n\nPage: ${body.page}\nIP country: ${request.cf?.country || ''}` }),
  });
  if (res.ok) return json({ ok: true });
  let detail = ''; try { detail = (await res.json()).message || ''; } catch {}
  return json({ error: 'Send failed', status: res.status, detail }, 502);
}
