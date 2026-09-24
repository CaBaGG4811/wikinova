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
  // A. anon articles list must hide drafts
  let r = await fetch(B + '/api/articles?pageSize=50');
  let d = await j(r);
  const items = d?.items || [];
  log('A. anon /api/articles ->', r.status, 'statuses:', JSON.stringify([...new Set(items.map(x => x.status))]));
  const draft = items.find(x => x.status !== 'published');
  log('   draft leaked in list:', !!draft);

  // B. anon direct draft access
  const all = await fetch(B + '/api/admin/articles?pageSize=50', { headers: { cookie: (await session('admin@wikinova.local','admin123')) } });
  // need admin for drafts list; simpler: query prisma-less via admin API
  // fallback: try known draft if any
  const ad = await j(all);
  const dr = (ad?.items || []).find(x => x.status === 'draft');
  if (dr) {
    const rd = await fetch(B + '/api/articles/' + dr.id);
    const page = await fetch(B + '/article/' + dr.slug);
    log('B. anon GET draft api ->', rd.status, ' page ->', page.status, 'slug=' + dr.slug);
  } else {
    // create draft to test
    const ck = await session('admin@wikinova.local','admin123');
    const rr = await fetch(B + '/api/articles', { method: 'POST', headers: { cookie: ck, 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Аудит черновик', slug: 'audit-draft-hidden', excerpt: 'черновик', content: '<p>d</p>', status: 'draft' }) });
    const created = await j(rr);
    if (created?.article) {
      const rd = await fetch(B + '/api/articles/' + created.article.id);
      const page = await fetch(B + '/article/' + created.article.slug);
      const sp = await fetch(B + '/api/articles/slug/' + created.article.slug);
      log('B. anon draft api ->', rd.status, 'page ->', page.status, 'slugApi ->', sp.status);
      const ckA = await session('admin@wikinova.local','admin123');
      await fetch(B + '/api/articles/' + created.article.id, { method: 'DELETE', headers: { cookie: ckA } });
      log('   draft cleaned');
    } else log('B. draft create failed', rr.status, JSON.stringify(created));
  }

  // C. editor can edit article (PUT)
  const ed = await session('editor@wikinova.local','editor123');
  const list = await j(await fetch(B + '/api/articles?pageSize=1'));
  const a0 = list?.items?.[0];
  if (a0) {
    const pu = await fetch(B + '/api/articles/' + a0.id, { method: 'PUT', headers: { cookie: ed, 'content-type': 'application/json' },
      body: JSON.stringify({ excerpt: a0.excerpt + '' }) });
    log('C. editor PUT article ->', pu.status, pu.status === 403 ? '(denied?)' : '');
  }

  // D. wrong password login
  const c2 = await fetch(B + '/api/auth/csrf');
  const { csrfToken } = await c2.json();
  const ck2 = c2.headers.getSetCookie().map(x => x.split(';')[0]).join('; ');
  const lr = await fetch(B + '/api/auth/callback/credentials', { method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/json', cookie: ck2 },
    body: JSON.stringify({ email: 'admin@wikinova.local', password: 'WRONG', csrfToken, json: 'true' }) });
  const setc = lr.headers.getSetCookie().join(' | ');
  log('D. bad password ->', lr.status, 'sessionCookieSet:', setc.includes('next-auth.session-token=;'), ' loc:', lr.headers.get('location'));

  // E. editor GET site settings API
  const rs = await fetch(B + '/api/admin/settings', { headers: { cookie: ed } });
  log('E. editor GET /api/admin/settings ->', rs.status);
  const rl = await fetch(B + '/api/admin/ai/logs?limit=1', { headers: { cookie: ed } });
  log('   editor GET /api/admin/ai/logs ->', rl.status);
  const ru = await fetch(B + '/api/admin/users', { headers: { cookie: ed } });
  const ud = await j(ru);
  log('   editor GET /api/admin/users ->', ru.status, 'emailsVisible:', (ud?.users || []).length);

  // F. editor DELETE user (must 403)
  const rdu = await fetch(B + '/api/admin/users', { method: 'DELETE', headers: { cookie: ed, 'content-type': 'application/json' }, body: JSON.stringify({ id: 'x' }) });
  log('F. editor DELETE user ->', rdu.status, rdu.status === 403 ? 'ok' : 'BAD');

  // G. anonymous admin API
  const ra = await fetch(B + '/api/admin/stats');
  log('G. anon GET /api/admin/stats ->', ra.status);

  // H. upload without auth
  const fd = new FormData();
  fd.append('file', new Blob([Buffer.from('x')], { type: 'image/jpeg' }), 'x.jpg');
  const rua = await fetch(B + '/api/upload', { method: 'POST', body: fd });
  log('H. anon upload ->', rua.status);

  // I. category/tag public endpoints
  const rc = await fetch(B + '/api/categories'); const rtag = await fetch(B + '/api/tags');
  log('I. categories ->', rc.status, 'tags ->', rtag.status);

  // J. article like/bookmark anon
  const rl2 = await fetch(B + '/api/articles/' + (a0?.id || 'x') + '/like', { method: 'POST' });
  log('J. anon like ->', rl2.status);

  // K. search page UI uses same API (status only)
  const rsp = await fetch(B + '/search?q=' + encodeURIComponent('квантовая'));
  log('K. GET /search?q=квантовая page ->', rsp.status);

  log('DONE-PART2');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
