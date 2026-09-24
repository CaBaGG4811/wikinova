const B = 'http://localhost:3001';
const log = console.log;
async function j(r){ try { return await r.json(); } catch { return null; } }
async function session(email, password) {
  const c = await fetch(B + '/api/auth/csrf');
  const { csrfToken } = await c.json();
  const ck = c.headers.getSetCookie().map(x => x.split(';')[0]).join('; ');
  const r = await fetch(B + '/api/auth/callback/credentials', { method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/json', cookie: ck },
    body: JSON.stringify({ email, password, csrfToken, json: 'true' }) });
  const extra = r.headers.getSetCookie().map(x => x.split(';')[0]).filter(x => x.startsWith('next-auth.'));
  return [ck, ...extra].join('; ');
}
(async () => {
  // A. anon list statuses
  let r = await fetch(B + '/api/articles?pageSize=50');
  let d = await j(r);
  const items = d?.items || [];
  log('A. anon list statuses:', JSON.stringify([...new Set(items.map(x => x.status))]), 'count=', items.length);

  // G. anon admin API
  r = await fetch(B + '/api/admin/stats');
  log('G. anon /api/admin/stats ->', r.status);

  // C. editor PATCH article (real edit endpoint)
  const ed = await session('editor@wikinova.local', 'editor123');
  const list = await j(await fetch(B + '/api/articles?pageSize=1'));
  const a0 = list?.items?.[0];
  if (a0) {
    r = await fetch(B + '/api/articles/' + a0.id, { method: 'PATCH', headers: { cookie: ed, 'content-type': 'application/json' },
      body: JSON.stringify({ excerpt: a0.excerpt }) });
    log('C. editor PATCH /api/articles/[id] ->', r.status);
    r = await fetch(B + '/api/admin/articles/' + a0.id, { method: 'PUT', headers: { cookie: ed, 'content-type': 'application/json' },
      body: JSON.stringify({ title: a0.title }) });
    log('C2. editor PUT /api/admin/articles/[id] ->', r.status);
  }

  // C3. anon PATCH article must be denied
  if (a0) {
    r = await fetch(B + '/api/articles/' + a0.id, { method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'HACKED' }) });
    log('C3. anon PATCH article ->', r.status);
    const after = await j(await fetch(B + '/api/articles/' + a0.id));
    log('    title unchanged:', after?.title === a0.title);
  }

  // E2. editor user list emails exposed?
  const ru = await fetch(B + '/api/admin/users', { headers: { cookie: ed } });
  const ud = await j(ru);
  log('E2. editor GET /api/admin/users ->', ru.status, 'n=', (ud?.users || []).length);

  // L. media rows with missing files (svg probes) via HTTP
  const urls = ['/uploads/images/202609-e7d47709-d06e-4a11-b3a7-ef32808c0bd3.svg',
    '/uploads/images/202609-72ff46c6-191a-4e7d-babe-b17b1f24785c.svg',
    '/uploads/images/202609-5e1ed1c3-cb7a-477c-8a0c-d5ec30257960.svg'];
  for (const u of urls) {
    const rr = await fetch(B + u);
    log('L.', u.split('/').pop(), '->', rr.status);
  }

  // M. admin AI usage/errors present
  const ck = await session('admin@wikinova.local', 'admin123');
  const usage = await j(await fetch(B + '/api/admin/ai/usage?range=24h', { headers: { cookie: ck } }));
  log('M. usage totals:', JSON.stringify(usage?.totals));

  // N. drafts count in admin list (editor can see drafts in admin API?)
  const ad = await j(await fetch(B + '/api/admin/articles?pageSize=50', { headers: { cookie: ed } }));
  log('N. editor admin list statuses:', JSON.stringify([...new Set((ad?.items || []).map(x => x.status))]));

  log('DONE-PART3');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
