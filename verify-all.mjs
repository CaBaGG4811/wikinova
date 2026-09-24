import { readFileSync } from 'fs';

const B = 'http://localhost:3001';
const log = console.log;
let fail = 0;

const ok = (cond, name, extra = '') => {
  if (cond) log(`PASS ${name} ${extra}`);
  else {
    fail++;
    log(`FAIL ${name} ${extra}`);
  }
};

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

async function readSse(res) {
  const text = await res.text();
  let acc = '';
  let done = null;
  let error = null;
  for (const line of text.split('\n')) {
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (!payload) continue;
    try {
      const obj = JSON.parse(payload);
      if (typeof obj.delta === 'string') acc += obj.delta;
      if (obj.done) done = obj;
      if (obj.error) error = obj.error;
    } catch {
      // ignore
    }
  }
  return { acc, done, error };
}

const clip = (s, n = 150) => String(s || '').replace(/\s+/g, ' ').slice(0, n);
const hasCyr = (s) => /[а-яёА-ЯЁ]{4,}/.test(String(s || ''));

function parseSseText(text) {
  let acc = '';
  let done = null;
  let error = null;
  for (const line of String(text).split('\n')) {
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (!payload) continue;
    try {
      const obj = JSON.parse(payload);
      if (typeof obj.delta === 'string') acc += obj.delta;
      if (obj.done) done = obj;
      if (obj.error) error = obj.error;
    } catch {
      // ignore
    }
  }
  return { acc, done, error, text: String(text) };
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

(async () => {
  // ===== Block 1: AI language =====
  log('--- Block 1: AI ---');
  const env = readFileSync(new URL('./.env', import.meta.url), 'utf8');
  const key = (env.match(/^AI_API_KEY=(.*)$/m) || [, ''])[1].trim();

  // warm up LM Studio model (first call can take ~50s / "Model is unloaded")
  try {
    const w0 = Date.now();
    const wr = await fetch('http://localhost:1234/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemma-4-12b-qat',
        messages: [{ role: 'user', content: 'Ответь одним словом: ок' }],
        max_tokens: 32,
      }),
    });
    const wj = await wr.json();
    log(`warmup status=${wr.status} ms=${Date.now() - w0} content=${clip(wj.choices?.[0]?.message?.content, 40)}`);
  } catch (e) {
    log(`warmup ERR ${e.message}`);
  }

  const adm = await session('admin@wikinova.local', 'admin123');
  const hdr = { cookie: adm, 'content-type': 'application/json' };

  const st = await j(await fetch(`${B}/api/admin/ai/settings`, { headers: hdr }));
  ok(st && Number(st.maxTokens) >= 6144, 'maxTokens >= 6144', `val=${st?.maxTokens}`);

  async function aiFetch(path, body, tries = 4) {
    let last = null;
    for (let i = 0; i < tries; i++) {
      const r = await fetch(`${B}${path}`, {
        method: 'POST',
        headers: hdr,
        body: JSON.stringify(body),
      });
      const text = await r.text();
      last = { r, text };
      if (text.includes('Model is unloaded') || text.includes('недоступна')) {
        log(`retry ${i + 1}/${tries} for ${path} (model unloaded)`);
        await new Promise((res) => setTimeout(res, 4000));
        // re-warm
        try {
          await fetch('http://localhost:1234/v1/chat/completions', {
            method: 'POST',
            headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
            body: JSON.stringify({
              model: 'google/gemma-4-12b-qat',
              messages: [{ role: 'user', content: 'ок' }],
              max_tokens: 16,
            }),
          });
        } catch {}
        continue;
      }
      break;
    }
    const sse = parseSseText(last.text);
    return { status: last.r.status, ...sse };
  }

  // draft
  const drRes = await aiFetch('/api/ai/draft', {
    topic: 'Квантовая запутанность',
    level: 'стандарт',
    style: 'энциклопедический',
  });
  const dd = safeJson(drRes.text);
  ok(drRes.status === 200 && dd?.title, 'draft ok', `title=${clip(dd?.title, 80)} err=${clip(dd?.error, 80)}`);
  ok(hasCyr(dd?.title) && hasCyr(dd?.content), 'draft in Russian', `preview=${clip(dd?.content)}`);

  // summarize SSE
  const list = await j(await fetch(`${B}/api/articles?pageSize=1`));
  const artId = list?.items?.[0]?.id;
  const ss = await aiFetch('/api/ai/summarize', { articleId: artId, refresh: true });
  ok(ss.status === 200 && ss.acc.length > 30 && ss.done, 'summarize SSE', `len=${ss.acc.length} err=${clip(ss.error, 100)}`);
  ok(hasCyr(ss.acc), 'summarize in Russian', `first150=${clip(ss.acc)}`);
  ok(!ss.text.includes('reasoning_content'), 'SSE hides reasoning_content');

  // qa global
  const qs = await aiFetch('/api/ai/qa/global', {
    messages: [{ role: 'user', content: 'Что такое квантовая запутанность?' }],
  });
  ok(qs.status === 200 && qs.acc.length > 20 && qs.done, 'qa global SSE', `len=${qs.acc.length} err=${clip(qs.error, 100)}`);
  ok(hasCyr(qs.acc), 'qa global in Russian', `first150=${clip(qs.acc)}`);

  // qa article
  const as_ = await aiFetch('/api/ai/qa/article', {
    articleId: artId,
    messages: [{ role: 'user', content: 'Кратко: о чём статья?' }],
  });
  ok(as_.status === 200 && as_.acc.length > 10, 'qa article SSE', `len=${as_.acc.length}`);
  ok(hasCyr(as_.acc), 'qa article in Russian', `first150=${clip(as_.acc)}`);

  // translate EN must stay English
  const ts = await aiFetch('/api/ai/translate', { articleId: artId, lang: 'en' });
  const enWords = (ts.acc.toLowerCase().match(/\b(the|and|of|in|is|to|is a|are)\b/g) || []).length;
  ok(ts.status === 200 && ts.acc.length > 30, 'translate en streams', `len=${ts.acc.length} err=${clip(ts.error, 100)}`);
  ok(enWords >= 3 || (!hasCyr(ts.acc) && ts.acc.length > 30), 'translate en is English', `first150=${clip(ts.acc)}`);

  // ===== Block 2: registration =====
  log('--- Block 2: registration ---');
  const email = `test${Date.now()}@example.com`;
  const reg = await fetch(`${B}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'test1234', name: 'Тест' }),
  });
  const regD = await j(reg);
  ok(reg.status === 201 && regD?.ok, 'register 201', `email=${email}`);

  const sess = await session(email, 'test1234');
  ok(sess.includes('next-auth.'), 'auto session cookies after register');

  // middleware: /profile requires auth for anon
  const profAnon = await fetch(`${B}/profile`, { redirect: 'manual' });
  ok(
    profAnon.status >= 300 && profAnon.status < 400,
    'anon /profile redirect',
    `status=${profAnon.status} loc=${profAnon.headers.get('location')}`,
  );

  const prof = await fetch(`${B}/profile`, {
    headers: { cookie: sess },
    redirect: 'manual',
  });
  ok(prof.status === 200, 'logged-in /profile 200', `status=${prof.status}`);

  // admin users: no email field for EDITOR
  const ed = await session('editor@wikinova.local', 'editor123');
  const usersR = await fetch(`${B}/api/admin/users`, { headers: { cookie: ed } });
  const usersD = await j(usersR);
  const firstUser = usersD?.users?.[0] || {};
  ok(usersR.status === 200 && Array.isArray(usersD?.users), 'admin users list', `n=${usersD?.users?.length}`);
  ok(!('email' in firstUser), 'email hidden in admin users API', `keys=${Object.keys(firstUser).join(',')}`);
  const newU = (usersD?.users || []).find((u) => u.name === 'Тест');
  ok(newU && newU.role === 'USER', 'new user visible as USER', `role=${newU?.role}`);

  // ===== Block 3: features =====
  log('--- Block 3: features ---');
  // rate
  const rateR = await fetch(`${B}/api/articles/${artId}/rate`, {
    method: 'POST',
    headers: { cookie: sess, 'content-type': 'application/json' },
    body: JSON.stringify({ value: 5 }),
  });
  const rateD = await j(rateR);
  ok(rateR.status === 200 && rateD?.value === 5, 'rate upsert 5', `avg=${rateD?.average} count=${rateD?.count}`);

  const rateBad = await fetch(`${B}/api/articles/${artId}/rate`, {
    method: 'POST',
    headers: { cookie: sess, 'content-type': 'application/json' },
    body: JSON.stringify({ value: 9 }),
  });
  ok(rateBad.status === 400, 'rate rejects value>5', `status=${rateBad.status}`);

  const rateAnon = await fetch(`${B}/api/articles/${artId}/rate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ value: 3 }),
  });
  ok(rateAnon.status === 401, 'rate requires auth', `status=${rateAnon.status}`);

  // collections
  const colR = await fetch(`${B}/api/collections`, {
    method: 'POST',
    headers: { cookie: sess, 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Тестовая подборка', description: 'для проверки', isPublic: true }),
  });
  const colD = await j(colR);
  const colId = colD?.collection?.id;
  ok(colR.status === 201 && colId, 'collection created', `id=${colId}`);

  const addR = await fetch(`${B}/api/collections/${colId}/items`, {
    method: 'POST',
    headers: { cookie: sess, 'content-type': 'application/json' },
    body: JSON.stringify({ articleId: artId }),
  });
  ok(addR.status === 201, 'article added to collection', `status=${addR.status}`);

  const addDup = await fetch(`${B}/api/collections/${colId}/items`, {
    method: 'POST',
    headers: { cookie: sess, 'content-type': 'application/json' },
    body: JSON.stringify({ articleId: artId }),
  });
  ok(addDup.status === 409, 'duplicate add 409', `status=${addDup.status}`);

  const colPage = await fetch(`${B}/collection/${colId}`);
  const colHtml = await colPage.text();
  ok(colPage.status === 200 && colHtml.includes('Тестовая подборка'), 'public collection page', `status=${colPage.status}`);

  const colsPage = await fetch(`${B}/collections`, { headers: { cookie: sess } });
  ok(colsPage.status === 200, 'collections page', `status=${colsPage.status}`);

  // private collection not visible to others
  const privR = await fetch(`${B}/api/collections`, {
    method: 'POST',
    headers: { cookie: sess, 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Личная', isPublic: false }),
  });
  const privD = await j(privR);
  const privPage = await fetch(`${B}/collection/${privD?.collection?.id}`);
  ok(privPage.status === 404, 'private collection 404 for anon', `status=${privPage.status}`);

  // graph
  const gPage = await fetch(`${B}/graph`);
  const gHtml = await gPage.text();
  ok(gPage.status === 200 && gHtml.includes('Карта знаний'), 'graph page 200', `status=${gPage.status}`);

  // admin articles includes ratings
  const admArt = await fetch(`${B}/api/admin/articles`, { headers: { cookie: adm } });
  const admArtD = await j(admArt);
  const artWithR = (admArtD?.articles || []).find((a) => a.id === artId);
  ok(
    admArt.status === 200 && Array.isArray(artWithR?.ratings),
    'admin articles has ratings',
    `ratings=${JSON.stringify(artWithR?.ratings)}`,
  );

  // article page renders rating stars markup
  const artPage = await fetch(`${B}/api/articles/slug/${(list?.items?.[0] || {}).slug}`);
  // use html page instead
  const slug = list?.items?.[0]?.slug;
  const artHtml = await (await fetch(`${B}/article/${slug}`)).text();
  ok(artHtml.includes('Рейтинг') || artHtml.includes('aria-label') || artHtml.includes('Оценить'), 'article page has rating UI', `slug=${slug}`);

  log(fail === 0 ? 'ALL CHECKS PASSED' : `FAILURES: ${fail}`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => {
  console.error('SCRIPT FAIL', e);
  process.exit(2);
});
