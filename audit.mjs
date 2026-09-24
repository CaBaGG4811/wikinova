const B = 'http://localhost:3001';
import fs from 'node:fs';
const out = [];
const log = (...a) => { const s = a.join(' '); out.push(s); console.log(s); };

async function j(res) { try { return await res.json(); } catch { return null; } }

async function makeSession(email, password) {
  const csrfRes = await fetch(B + '/api/auth/csrf');
  const csrf = (await csrfRes.json()).csrfToken;
  const ck = (csrfRes.headers.getSetCookie()).map(c => c.split(';')[0]).join('; ');
  const r = await fetch(B + '/api/auth/callback/credentials', {
    method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/json', cookie: ck },
    body: JSON.stringify({ email, password, csrfToken: csrf, json: 'true' }),
  });
  const extra = (r.headers.getSetCookie()).map(c => c.split(';')[0]).filter(c => c.startsWith('next-auth.'));
  const cookie = [ck, ...extra].join('; ');
  const session = await j(await fetch(B + '/api/auth/session', { headers: { cookie } }));
  return { cookie, session };
}

async function get(url, opts = {}, timeout = 60000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    return await fetch(B + url, { ...opts, signal: ctrl.signal, redirect: 'manual' });
  } finally { clearTimeout(t); }
}

(async () => {
  // ---------- 2.2 pages (anon) ----------
  const anonPages = ['/', '/articles', '/article/kvantovaya-mehanika-osnovy', '/search?q=' + encodeURIComponent('наука'),
    '/category/nauka', '/tag/fizika', '/request', '/about', '/contact', '/rules', '/admin/login'];
  log('== ANON PAGES ==');
  for (const p of anonPages) {
    const r = await get(p, {}, 90000);
    log(`${r.status} ${p} loc=${r.headers.get('location') || ''}`);
  }
  log('== ADMIN WITHOUT SESSION ==');
  for (const p of ['/admin', '/admin/articles', '/admin/ai/settings']) {
    const r = await get(p, {}, 30000);
    log(`${r.status} ${p} loc=${r.headers.get('location') || ''}`);
  }

  // ---------- auth ----------
  log('== LOGIN ==');
  const admin = await makeSession('admin@wikinova.local', 'admin123');
  log('admin session:', JSON.stringify(admin.session?.user || null));
  const editor = await makeSession('editor@wikinova.local', 'editor123');
  log('editor session:', JSON.stringify(editor.session?.user || null));

  const ah = { cookie: admin.cookie, 'content-type': 'application/json' };
  const eh = { cookie: editor.cookie, 'content-type': 'application/json' };

  // ---------- admin pages ----------
  log('== ADMIN PAGES (admin) ==');
  const adminPages = ['/admin', '/admin/articles', '/admin/articles/new', '/admin/articles/cmue4040j000t5tnu16cyslwv/edit',
    '/admin/media', '/admin/requests', '/admin/users', '/admin/categories', '/admin/tags', '/admin/settings',
    '/admin/ai/settings', '/admin/ai/prompts', '/admin/ai/usage', '/admin/ai/logs'];
  for (const p of adminPages) {
    const r = await get(p, { headers: { cookie: admin.cookie } }, 90000);
    log(`${r.status} ${p} loc=${r.headers.get('location') || ''}`);
  }

  // ---------- roles ----------
  log('== ROLES ==');
  let r = await get('/admin/users', { headers: { cookie: editor.cookie } }, 30000);
  log(`editor GET /admin/users -> ${r.status} loc=${r.headers.get('location') || ''}`);
  r = await get('/api/admin/users', { headers: { cookie: editor.cookie } }, 30000);
  log(`editor GET /api/admin/users -> ${r.status} ${r.status === 200 ? 'BAD(editor allowed!)' : 'ok'}`);
  // editor create article
  r = await get('/api/articles', { method: 'POST', headers: eh, body: JSON.stringify({ title: 'Ролевой тест редактора', excerpt: 'роль', content: '<p>текст</p>', status: 'draft' }) }, 30000);
  const ej = await j(r);
  log(`editor POST /api/articles -> ${r.status} id=${ej?.article?.id || JSON.stringify(ej).slice(0, 120)}`);
  const editorArticleId = ej?.article?.id;
  if (editorArticleId) {
    r = await get('/api/articles/' + editorArticleId, { method: 'DELETE', headers: eh }, 30000);
    log(`editor DELETE /api/articles/${editorArticleId} -> ${r.status} ${r.status === 200 ? 'BAD(editor deleted!)' : 'ok (denied expected)'}`);
    // cleanup by admin
    r = await get('/api/articles/' + editorArticleId, { method: 'DELETE', headers: ah }, 30000);
    log(`admin cleanup DELETE -> ${r.status}`);
  }

  // ---------- scenario 1: create article via API (as admin) ----------
  log('== S1 CREATE ARTICLE ==');
  const html = `<p>Введение аудита.</p><h2 id="razdel">Раздел</h2><p>С <a href="https://example.com">ссылкой</a>.</p>` +
    `<iframe width="560" height="315" src="https://www.youtube.com/embed/dQw4w9WgXcQ" frameborder="0" allowfullscreen></iframe>` +
    `<video controls src="/uploads/videos/audit.mp4"></video>` +
    `<table><tr><th>Ячейка</th></tr><tr><td>1</td></tr></table><blockquote>Цитата</blockquote><hr/>`;
  r = await get('/api/articles', { method: 'POST', headers: ah, body: JSON.stringify({
    title: 'Аудит: сквозной сценарий', slug: 'audit-cross-scenario', excerpt: 'Проверка публикации из админки',
    content: html, status: 'published', featured: false,
  }) }, 30000);
  const created = await j(r);
  log(`POST /api/articles -> ${r.status} slug=${created?.article?.slug || JSON.stringify(created).slice(0, 200)}`);
  const artSlug = created?.article?.slug;
  if (artSlug) {
    const page = await get('/article/' + artSlug, {}, 60000);
    const pageHtml = await page.text();
    log(`GET /article/${artSlug} -> ${page.status}`);
    log(`  contains link: ${pageHtml.includes('https://example.com')}, iframe: ${pageHtml.includes('youtube.com/embed')}`);
    log(`  contains <video: ${pageHtml.includes('<video')}, contains <table: ${pageHtml.includes('<table')}, contains blockquote: ${pageHtml.includes('blockquote')}`);
  }

  // ---------- scenario 2: request ----------
  log('== S2 REQUEST ==');
  r = await get('/api/requests', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ topic: 'Аудит: тема заявки', description: 'Описание заявки аудита', category: 'nauka', level: 'standard', email: 'audit@local.test', name: 'Аудитор' }) }, 30000);
  const req = await j(r);
  log(`POST /api/requests -> ${r.status} id=${req?.request?.id || ''} status=${req?.request?.status || ''}`);
  r = await get('/api/admin/requests', { headers: { cookie: admin.cookie } }, 30000);
  const list = await j(r);
  const items = list?.requests || list?.items || list?.rows || [];
  const found = items.find(x => x.email === 'audit@local.test');
  log(`GET /api/admin/requests -> ${r.status} found audit request: ${!!found} status=${found?.status}`);

  // ---------- scenario 3: summarize SSE ----------
  log('== S3 SUMMARIZE ==');
  const art = await j(await get('/api/articles?pageSize=1&sort=views', { headers: { cookie: admin.cookie } }, 30000));
  const artId = (art?.items || [])[0]?.id;
  log(`articleId=${artId}`);
  r = await get('/api/ai/summarize', { method: 'POST', headers: ah, body: JSON.stringify({ articleId: artId }) }, 120000);
  log(`POST /api/ai/summarize -> ${r.status} ct=${r.headers.get('content-type')}`);
  const sseText = await r.text();
  log('SSE head: ' + sseText.slice(0, 400).replace(/\n/g, ' | '));

  // ---------- scenario 4: qa/article ----------
  log('== S4 QA ARTICLE ==');
  r = await get('/api/ai/qa/article', { method: 'POST', headers: ah, body: JSON.stringify({ articleId: artId, messages: [{ role: 'user', content: 'О чём статья?' }] }) }, 120000);
  const qa = await r.text();
  log(`POST /api/ai/qa/article -> ${r.status} head: ${qa.slice(0, 250).replace(/\n/g, ' | ')}`);

  // ---------- scenario 5: qa/global ----------
  log('== S5 QA GLOBAL ==');
  r = await get('/api/ai/qa/global', { method: 'POST', headers: ah, body: JSON.stringify({ messages: [{ role: 'user', content: 'Что такое наука?' }] }) }, 120000);
  const qg = await r.text();
  log(`POST /api/ai/qa/global -> ${r.status} head: ${qg.slice(0, 350).replace(/\n/g, ' | ')}`);

  // ---------- scenario 6: draft ----------
  log('== S6 DRAFT ==');
  r = await get('/api/ai/draft', { method: 'POST', headers: ah, body: JSON.stringify({ topic: 'Квантовая запутанность', level: 'кратко', style: 'энциклопедический' }) }, 180000);
  log(`POST /api/ai/draft -> ${r.status} body: ${(await r.text()).slice(0, 250)}`);

  // ---------- scenario 7: translate ----------
  log('== S7 TRANSLATE ==');
  r = await get('/api/ai/translate', { method: 'POST', headers: ah, body: JSON.stringify({ articleId: artId, lang: 'en' }) }, 180000);
  const tr = await r.text();
  log(`POST /api/ai/translate -> ${r.status} head: ${tr.slice(0, 250).replace(/\n/g, ' | ')}`);

  // ---------- scenario 8: media upload ----------
  log('== S8 MEDIA UPLOAD ==');
  const jpg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');
  const fd = new FormData();
  fd.append('file', new Blob([jpg], { type: 'image/jpeg' }), 'audit.jpg');
  fd.append('folder', 'images');
  r = await get('/api/upload', { method: 'POST', headers: { cookie: admin.cookie }, body: fd }, 60000);
  const up = await j(r);
  log(`POST /api/upload jpg -> ${r.status} url=${up?.url || JSON.stringify(up).slice(0, 150)}`);
  if (up?.url) {
    const f = await get(up.url, {}, 15000);
    log(`GET ${up.url} -> ${f.status}`);
  }
  // traversal test
  const fd2 = new FormData();
  fd2.append('file', new Blob([jpg], { type: 'image/jpeg' }), '..%2F..%2Fevil.jpg');
  fd2.append('folder', 'images');
  r = await get('/api/upload', { method: 'POST', headers: { cookie: admin.cookie }, body: fd2 }, 60000);
  const up2 = await j(r);
  log(`POST /api/upload traversal-name -> ${r.status} url=${up2?.url || JSON.stringify(up2).slice(0, 150)}`);
  // wrong extension
  const fd3 = new FormData();
  fd3.append('file', new Blob([Buffer.from('console.log(1)')], { type: 'application/javascript' }), 'x.js');
  fd3.append('folder', 'images');
  r = await get('/api/upload', { method: 'POST', headers: { cookie: admin.cookie }, body: fd3 }, 30000);
  log(`POST /api/upload .js -> ${r.status} ${r.status === 201 ? 'BAD(js allowed!)' : 'ok denied'}`);
  // media list + delete
  r = await get('/api/admin/media', { headers: { cookie: admin.cookie } }, 30000);
  const media = await j(r);
  const rows = media?.items || media?.media || media?.rows || [];
  log(`GET /api/admin/media -> ${r.status} count=${rows.length}`);
  if (up?.id) {
    r = await get('/api/admin/media/' + up.id, { method: 'DELETE', headers: ah }, 30000);
    log(`DELETE media -> ${r.status}`);
    const path = up.url.replace('/uploads/', 'public/uploads/');
    log(`file removed from disk: ${!fs.existsSync(path)}`);
  }

  // ---------- scenario 9: AI settings ----------
  log('== S9 AI SETTINGS ==');
  r = await get('/api/admin/ai/settings', { headers: { cookie: admin.cookie } }, 30000);
  const ai0 = await j(r);
  log(`GET settings -> ${r.status} baseUrl=${JSON.stringify(ai0?.settings?.baseUrl ?? ai0?.baseUrl)}`);
  r = await get('/api/admin/ai/test', { method: 'POST', headers: ah, body: JSON.stringify({}) }, 60000);
  log(`POST /api/admin/ai/test -> ${r.status} ${JSON.stringify(await j(r))}`);
  // save without /v1, check normalization, then restore
  const baseNoV1 = 'http://localhost:1234';
  r = await get('/api/admin/ai/settings', { method: 'PUT', headers: ah, body: JSON.stringify({ baseUrl: baseNoV1 }) }, 30000);
  log(`PUT baseUrl without /v1 -> ${r.status}`);
  r = await get('/api/admin/ai/settings', { headers: { cookie: admin.cookie } }, 30000);
  const ai1 = await j(r);
  const b1 = ai1?.settings?.baseUrl ?? ai1?.baseUrl;
  log(`re-read baseUrl=${b1} normalized=${b1?.endsWith('/v1') ? 'YES' : 'NO -> BUG: no /v1 normalization'}`);
  // temperature save/reset
  r = await get('/api/admin/ai/settings', { method: 'PUT', headers: ah, body: JSON.stringify({ temperature: 1.25 }) }, 30000);
  log(`PUT temperature 1.25 -> ${r.status}`);
  r = await get('/api/admin/ai/settings', { headers: { cookie: admin.cookie } }, 30000);
  const ai2 = await j(r);
  log(`temperature re-read=${ai2?.settings?.temperature ?? ai2?.temperature}`);
  r = await get('/api/admin/ai/settings', { method: 'PUT', headers: ah, body: JSON.stringify({ reset: true }) }, 30000);
  log(`PUT reset -> ${r.status}`);
  r = await get('/api/admin/ai/settings', { headers: { cookie: admin.cookie } }, 30000);
  const ai3 = await j(r);
  log(`after reset baseUrl=${ai3?.settings?.baseUrl ?? ai3?.baseUrl} temp=${ai3?.settings?.temperature ?? ai3?.temperature}`);

  // ---------- scenario 10: dashboard ----------
  log('== S10 DASHBOARD ==');
  r = await get('/api/admin/stats', { headers: { cookie: admin.cookie } }, 30000);
  const st = await j(r);
  log(`GET /api/admin/stats -> ${r.status} chartDays=${st?.chart?.length} recent=${st?.recent?.length} articles=${st?.articles?.total}`);

  // ---------- search / FTS ----------
  log('== SEARCH ==');
  r = await get('/api/search?q=' + encodeURIComponent('наука'), {}, 30000);
  const se = await j(r);
  log(`search "наука" -> ${r.status} total=${se?.total} items=${se?.items?.length}`);
  r = await get('/api/search?q=' + encodeURIComponent('квантовая'), {}, 30000);
  const se2 = await j(r);
  log(`search "квантовая" -> ${r.status} total=${se2?.total} items=${se2?.items?.length}`);

  // ---------- rate limit anon ----------
  log('== RATE LIMIT (anon x11) ==');
  const statuses = [];
  for (let i = 0; i < 11; i++) {
    try {
      const rr = await get('/api/ai/summarize', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ articleId: artId }) }, 60000);
      statuses.push(rr.status);
      if (rr.status === 429) {
        log(`429 at attempt ${i + 1}: ${JSON.stringify(await rr.json())}`);
        break;
      }
      await rr.text();
    } catch (e) { statuses.push('ERR:' + e.message); }
  }
  log('rate-limit statuses: ' + statuses.join(','));

  // ---------- abort stream ----------
  log('== ABORT STREAM ==');
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 1500);
    const rr = await fetch(B + '/api/ai/summarize', { method: 'POST', headers: ah, body: JSON.stringify({ articleId: artId }), signal: ctrl.signal });
    const partial = await rr.text().catch(e => 'text-error:' + e.message);
    log(`abort -> status=${rr.status} partial=${partial.slice(0, 150).replace(/\n/g, ' | ')}`);
  } catch (e) { log(`abort threw: ${e.name}:${e.message}`); }

  // ---------- signout ----------
  log('== SIGNOUT ==');
  const csrfR = await get('/api/auth/csrf', { headers: { cookie: admin.cookie } }, 15000);
  const csrfTok = (await csrfR.json()).csrfToken;
  const so = await get('/api/auth/signout', { method: 'POST', headers: { cookie: admin.cookie, 'content-type': 'application/json' }, body: JSON.stringify({ csrfToken: csrfTok }) }, 15000);
  const cleared = (so.headers.getSetCookie() || []).filter(c => c.startsWith('next-auth.session-token') && c.includes('=;'));
  log(`signout -> ${so.status} session-cleared-cookie=${cleared.length > 0}`);
  const sessAfter = await j(await get('/api/auth/session', { headers: { cookie: admin.cookie } }, 15000));
  log(`session after signout: ${JSON.stringify(sessAfter)}`);

  // ---------- similar / fact-check (no LLM path) ----------
  log('== SIMILAR ==');
  r = await get('/api/ai/similar', { method: 'POST', headers: ah, body: JSON.stringify({ articleId: artId }) }, 30000);
  const sim = await j(r);
  log(`similar -> ${r.status} sources=${sim?.sources?.length}`);

  // ---------- prompts / usage / logs ----------
  log('== ADMIN AI ENDPOINTS ==');
  for (const p of ['/api/admin/ai/prompts', '/api/admin/ai/usage?range=24h', '/api/admin/ai/logs?limit=5']) {
    r = await get(p, { headers: { cookie: admin.cookie } }, 30000);
    const body = await r.text();
    log(`${p} -> ${r.status} ${body.slice(0, 160)}`);
  }

  // cleanup scenario 1 article
  if (artSlug) {
    const a = created.article;
    r = await get('/api/articles/' + a.id, { method: 'DELETE', headers: ah }, 30000);
    log(`cleanup audit article -> ${r.status}`);
  }

  fs.writeFileSync('audit-raw.log', out.join('\n'));
  log('DONE');
})().catch(e => { console.error('SCRIPT FAIL', e); process.exit(1); });
