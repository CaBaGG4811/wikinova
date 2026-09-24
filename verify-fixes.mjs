const B = 'http://localhost:3001';
const log = console.log;
async function j(r) { try { return await r.json(); } catch { return null; } }
async function session(email, password) {
  const c = await fetch(B + '/api/auth/csrf');
  const { csrfToken } = await c.json();
  const ck = c.headers.getSetCookie().map((x) => x.split(';')[0]).join('; ');
  const r = await fetch(B + '/api/auth/callback/credentials', {
    method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/json', cookie: ck },
    body: JSON.stringify({ email, password, csrfToken, json: 'true' }),
  });
  const extra = r.headers.getSetCookie().map((x) => x.split(';')[0]).filter((x) => x.startsWith('next-auth.'));
  return [ck, ...extra].join('; ');
}

(async () => {
  let fail = 0;
  const ok = (cond, name, extra = '') => {
    if (cond) log(`PASS ${name} ${extra}`);
    else { fail++; log(`FAIL ${name} ${extra}`); }
  };

  // --- Check 3: search ---
  for (const q of ['квантовая', 'Квантовая', 'наука']) {
    const r = await fetch(`${B}/api/search?q=${encodeURIComponent(q)}`);
    const d = await j(r);
    ok(r.status === 200 && d && d.total >= 1, `search "${q}"`, `status=${r.status} total=${d?.total} titles=${JSON.stringify((d?.items || []).map((x) => x.title).slice(0, 3))}`);
  }

  // --- Check 4: anon rate limit, 11 calls ---
  // articleId: first published
  const list = await j(await fetch(`${B}/api/articles?pageSize=1`));
  const artId = list?.items?.[0]?.id;
  const statuses = [];
  let rlBody = null;
  let rlHeaders = null;
  for (let i = 0; i < 11; i++) {
    const r = await fetch(`${B}/api/ai/summarize`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ articleId: artId }),
    });
    statuses.push(r.status);
    if (r.status === 429) {
      rlBody = await j(r);
      rlHeaders = { retryAfter: r.headers.get('retry-after') };
      break;
    }
    await r.text();
  }
  ok(statuses[10] === 429, 'rate-limit 11th anon = 429', `statuses=${statuses.join(',')} body=${JSON.stringify(rlBody)} retry-after=${rlHeaders?.retryAfter}`);

  // --- Check 5: base URL normalization ---
  const ck = await session('admin@wikinova.local', 'admin123');
  const hdr = { cookie: ck, 'content-type': 'application/json' };

  let r = await fetch(`${B}/api/admin/ai/settings`, { method: 'PUT', headers: hdr, body: JSON.stringify({ baseUrl: 'http://localhost:1234' }) });
  let d = await j(r);
  ok(r.status === 200 && d?.baseUrl === 'http://localhost:1234/v1', 'PUT without /v1 -> stored /v1', `status=${r.status} baseUrl=${d?.baseUrl}`);

  r = await fetch(`${B}/api/admin/ai/settings`, { method: 'PUT', headers: hdr, body: JSON.stringify({ baseUrl: 'http://localhost:1234/v1/' }) });
  d = await j(r);
  ok(r.status === 200 && d?.baseUrl === 'http://localhost:1234/v1', 'PUT with trailing slash -> clean', `status=${r.status} baseUrl=${d?.baseUrl}`);

  r = await fetch(`${B}/api/admin/ai/settings`, { method: 'PUT', headers: hdr, body: JSON.stringify({ baseUrl: 'not-a-url' }) });
  ok(r.status === 400, 'PUT invalid url -> 400', `status=${r.status}`);

  // restore canonical value
  r = await fetch(`${B}/api/admin/ai/settings`, { method: 'PUT', headers: hdr, body: JSON.stringify({ baseUrl: 'http://localhost:1234/v1' }) });
  d = await j(r);
  log(`restored baseUrl=${d?.baseUrl}`);

  // --- DB check: ip: rows appeared ---
  log(fail === 0 ? 'ALL CHECKS PASSED' : `FAILURES: ${fail}`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error('SCRIPT FAIL', e); process.exit(2); });
