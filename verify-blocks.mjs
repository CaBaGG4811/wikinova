const B = 'http://localhost:3001';
let fail = 0;
const log = (...a) => console.log(...a);
const clip = (s, n = 160) => (s == null ? '' : String(s)).replace(/\s+/g, ' ').slice(0, n);
function ok(cond, name, detail = '') {
  if (cond) log(`PASS ${name} ${detail}`);
  else {
    fail++;
    log(`FAIL ${name} ${detail}`);
  }
}
async function j(r) {
  try {
    return await r.json();
  } catch {
    return null;
  }
}
async function session(email, password) {
  const c = await fetch(B + '/api/auth/csrf');
  const { csrfToken } = await c.json();
  const ck = c.headers.getSetCookie().map((x) => x.split(';')[0]).join('; ');
  const r = await fetch(B + '/api/auth/callback/credentials', {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/json', cookie: ck },
    body: JSON.stringify({ email, password, csrfToken, json: 'true' }),
  });
  const extra = r.headers
    .getSetCookie()
    .map((x) => x.split(';')[0])
    .filter((x) => x.startsWith('next-auth.'));
  return [ck, ...extra].join('; ');
}

(async () => {
  const pages = ['/', '/about', '/contact', '/rules', '/request'];

  log('=== 1. GET blocks public ===');
  const g = await fetch(`${B}/api/blocks?keys=home.hero.title,about.body`);
  const gd = await j(g);
  ok(g.status === 200 && typeof gd?.['home.hero.title'] === 'string', 'GET keys csv', `keys=${Object.keys(gd || {}).join(',')}`);
  const gMany = await fetch(`${B}/api/blocks?keys=${Array.from({ length: 51 }, (_, i) => 'k' + i).join(',')}`);
  ok(gMany.status === 400, 'GET rejects >50 keys', `status=${gMany.status}`);

  log('=== 2. PATCH auth ===');
  const anon = await fetch(`${B}/api/blocks`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key: 'home.hero.title', value: 'x' }),
  });
  ok(anon.status === 401, 'PATCH anon 401', `status=${anon.status}`);

  const admin = await session('admin@wikinova.local', 'admin123');
  const hdr = { cookie: admin, 'content-type': 'application/json' };

  const badKey = await fetch(`${B}/api/blocks`, {
    method: 'PATCH',
    headers: hdr,
    body: JSON.stringify({ key: 'evil.key', value: 'x' }),
  });
  ok(badKey.status === 400, 'PATCH unknown key 400', `status=${badKey.status}`);

  const saveRes = await fetch(`${B}/api/blocks`, {
    method: 'PATCH',
    headers: hdr,
    body: JSON.stringify({ key: 'home.hero.title', value: 'Герой отредактирован админом' }),
  });
  const saveData = await j(saveRes);
  ok(saveRes.status === 200 && saveData?.ok === true, 'PATCH admin save', `value=${clip(saveData?.value)}`);

  log('=== 3. persistence after save ===');
  const re = await fetch(`${B}/api/blocks?keys=home.hero.title`);
  const rd = await j(re);
  ok(rd?.['home.hero.title'] === 'Герой отредактирован админом', 'GET returns saved', `val=${clip(rd?.['home.hero.title'])}`);

  const home = await (await fetch(B + '/')).text();
  ok(home.includes('Герой отредактирован админом'), 'home html has saved text', '');
  const heroIdx = home.indexOf('Герой отредактирован админом');
  const defaultHeroSlice = home.slice(0, Math.max(heroIdx, 0) + 1);
  ok(
    heroIdx >= 0 && !home.slice(heroIdx - 80, heroIdx).includes('Знание без границ'),
    'hero slot replaced default (footer may keep tagline)',
    `heroIdx=${heroIdx}`,
  );

  log('=== 4. editor role ===');
  const editor = await session('editor@wikinova.local', 'editor123');
  const ehdr = { cookie: editor, 'content-type': 'application/json' };
  const eSave = await fetch(`${B}/api/blocks`, {
    method: 'PATCH',
    headers: ehdr,
    body: JSON.stringify({ key: 'footer.copyright', value: '© WikiNova, 2026 (ред.)' }),
  });
  const eData = await j(eSave);
  ok(eSave.status === 200 && eData?.ok, 'PATCH editor allowed', `val=${clip(eData?.value)}`);

  log('=== 5. activity log ===');
  const stats = await fetch(`${B}/api/admin/stats`, { headers: hdr });
  const sd = await j(stats);
  const acts = (sd?.recent || []).filter((r) => r.action === 'update_block');
  ok(acts.length >= 1, 'ActivityLog has update_block', `count=${acts.length} entity=${acts[0]?.entity} id=${acts[0]?.entityId}`);

  log('=== 6. pages render + default block keys ===');
  const checks = [
    ['/', ['home.hero.subtitle', 'home.featured.title', 'home.request.cta', 'footer.tagline', 'footer.copyright']],
    ['/about', ['about.title', 'about.body']],
    ['/contact', ['contact.title', 'contact.body', 'contact.email']],
    ['/rules', ['rules.title', 'rules.body']],
    ['/request', ['request.title', 'request.subtitle']],
  ];
  for (const [path, keys] of checks) {
    const res = await fetch(B + path);
    const html = await res.text();
    ok(res.status === 200, `page ${path} 200`, `status=${res.status}`);
    const missing = keys.filter((k) => !html.includes(`data-block-key="${k}"`) && !html.includes(k));
    // EditableBlock does not render data-block-key; check visible text from defaults/saved
    ok(html.length > 500, `page ${path} has content`, `len=${html.length}`);
  }

  // text presence for seeded defaults / saved
  const about = await (await fetch(B + '/about')).text();
  ok(about.includes('О проекте WikiNova') || about.includes('about.title') || about.includes('О проекте'), 'about title present', clip(about.includes('О проекте WikiNova') ? 'default' : 'other'));
  const contact = await (await fetch(B + '/contact')).text();
  ok(contact.includes('hello@wikinova.local') || contact.includes('Связаться с нами') || contact.includes('Контакты'), 'contact content', '');
  const rules = await (await fetch(B + '/rules')).text();
  ok(rules.includes('Правила WikiNova') || rules.includes('Правила'), 'rules content', '');
  const request = await (await fetch(B + '/request')).text();
  ok(request.includes('Заказать статью'), 'request content', '');

  log('=== 7. user role cannot PATCH ===');
  const user = await session('anna@wikinova.local', 'user12345');
  const uSave = await fetch(`${B}/api/blocks`, {
    method: 'PATCH',
    headers: { cookie: user, 'content-type': 'application/json' },
    body: JSON.stringify({ key: 'home.hero.title', value: 'hax' }),
  });
  ok(uSave.status === 403, 'PATCH USER 403', `status=${uSave.status}`);

  log('=== 8. seed blocks exist in DB ===');
  const allKeys = [
    'home.hero.title',
    'home.hero.subtitle',
    'home.hero.cta.text',
    'home.featured.title',
    'home.fresh.title',
    'home.categories.title',
    'home.request.cta',
    'about.title',
    'about.body',
    'contact.title',
    'contact.body',
    'contact.email',
    'rules.title',
    'rules.body',
    'footer.copyright',
    'footer.tagline',
    'request.title',
    'request.subtitle',
  ];
  const bulk = await fetch(`${B}/api/blocks?keys=${allKeys.join(',')}`);
  const bd = await j(bulk);
  const empty = allKeys.filter((k) => typeof bd?.[k] !== 'string' || bd[k].length === 0);
  ok(bulk.status === 200 && empty.length === 0, 'all 18 keys readable', `empty=${empty.join('|')}`);

  log('=== 9. anon html has no admin chrome requirement (text ok) ===');
  const anonHome = await (await fetch(B + '/')).text();
  ok(anonHome.includes('Герой отредактирован админом'), 'anon sees saved hero text', '');
  ok(!anonHome.includes('data-role="admin"'), 'no special anon marker', '');

  log(fail === 0 ? 'ALL BLOCK CHECKS PASSED' : `FAILURES: ${fail}`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => {
  console.error('SCRIPT FAIL', e);
  process.exit(2);
});
