const B = 'http://localhost:3001';
let fail = 0;
const log = (...a) => console.log(...a);
const clip = (s, n = 140) => (s == null ? '' : String(s)).replace(/\s+/g, ' ').slice(0, n);
const hasCyr = (s) => /[а-яё]/i.test(String(s || ''));
function ok(cond, name, detail = '') {
  if (cond) log(`PASS ${name} ${detail}`);
  else { fail++; log(`FAIL ${name} ${detail}`); }
}
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(hdr, path, body, { tries = 4, waitMs = 18000 } = {}) {
  let acc = '', text = '', status = 0, done = false, error = '', json = null, t0 = 0;
  for (let attempt = 1; attempt <= tries; attempt++) {
    acc = ''; text = ''; status = 0; done = false; error = ''; json = null;
    t0 = Date.now();
    try {
      const r = await fetch(B + path, {
        method: 'POST', headers: hdr, body: JSON.stringify(body),
      });
      status = r.status;
      const ct = r.headers.get('content-type') || '';
      if (ct.includes('text/event-stream')) {
        const reader = r.body.getReader();
        const dec = new TextDecoder();
        for (;;) {
          const { value, done: d } = await reader.read();
          if (d) break;
          const chunk = dec.decode(value, { stream: true });
          text += chunk;
          for (const line of chunk.split('\n')) {
            if (line.startsWith('data: ')) {
              const payload = line.slice(6);
              if (payload === '[DONE]') { done = true; continue; }
              try {
                const obj = JSON.parse(payload);
                if (obj.error) error = String(obj.error);
                if (typeof obj.delta === 'string') acc += obj.delta;
                if (obj.done) done = true;
              } catch {}
            }
          }
        }
      } else {
        const t = await r.text();
        text = t;
        try { json = JSON.parse(t); } catch {}
        if (json?.error) error = String(json.error);
        if (status >= 400 && !error) error = clip(t, 120);
      }
    } catch (e) {
      error = e.message;
    }
    const ms = Date.now() - t0;
    log(`  call ${path} try=${attempt} status=${status} ms=${ms} len=${acc.length || text.length} err=${clip(error, 110)}`);
    const modelDown = /unloaded|недоступна/i.test(error + text);
    const rate = status === 429 || /слишком много/i.test(error);
    if ((status === 200 && !error && (acc.length > 0 || json)) || (!modelDown && !rate && attempt === tries)) break;
    if (attempt < tries) {
      const pause = modelDown || rate ? waitMs + 8000 : waitMs;
      log(`  wait ${pause}ms before retry`);
      await sleep(pause);
    }
  }
  return { acc, text, status, done, error, json, ms: Date.now() - t0 };
}

(async () => {
  const adm = await session('admin@wikinova.local', 'admin123');
  const hdr = { cookie: adm, 'content-type': 'application/json' };

  const st = await j(await fetch(`${B}/api/admin/ai/settings`, { headers: hdr }));
  ok(st && Number(st.maxTokens) >= 6144, 'maxTokens >= 6144', `val=${st?.maxTokens}`);

  await fetch(`${B}/api/admin/ai/settings`, {
    method: 'PUT', headers: hdr,
    body: JSON.stringify({ timeoutMs: 180000 }),
  });

  await sleep(20000);

  log('=== draft ===');
  const dr = await call(hdr, '/api/ai/draft', {
    topic: 'Квантовая запутанность',
    level: 'стандарт',
    style: 'энциклопедический',
  });
  const dd = dr.json;
  ok(dr.status === 200 && dd?.title, 'draft ok', `title=${clip(dd?.title, 80)} err=${clip(dd?.error, 100)}`);
  ok(hasCyr(dd?.title) && hasCyr(dd?.content), 'draft in Russian', `preview=${clip(dd?.content)}`);

  await sleep(25000);

  const list = await j(await fetch(`${B}/api/articles?pageSize=1`));
  const artId = list?.items?.[0]?.id;

  log('=== summarize ===');
  const ss = await call(hdr, '/api/ai/summarize', { articleId: artId, refresh: true });
  ok(ss.status === 200 && ss.acc.length > 30 && ss.done, 'summarize SSE', `len=${ss.acc.length} err=${clip(ss.error, 90)}`);
  ok(hasCyr(ss.acc), 'summarize in Russian', `first150=${clip(ss.acc)}`);
  ok(!ss.text.includes('reasoning_content'), 'SSE hides reasoning_content');

  await sleep(25000);

  log('=== qa global ===');
  const qs = await call(hdr, '/api/ai/qa/global', {
    messages: [{ role: 'user', content: 'Что такое квантовая запутанность?' }],
  });
  ok(qs.status === 200 && qs.acc.length > 20 && qs.done, 'qa global SSE', `len=${qs.acc.length} err=${clip(qs.error, 90)}`);
  ok(hasCyr(qs.acc), 'qa global in Russian', `first150=${clip(qs.acc)}`);

  await sleep(25000);

  log('=== qa article ===');
  const as_ = await call(hdr, '/api/ai/qa/article', {
    articleId: artId,
    messages: [{ role: 'user', content: 'Кратко: о чём статья?' }],
  });
  ok(as_.status === 200 && as_.acc.length > 10, 'qa article SSE', `len=${as_.acc.length} err=${clip(as_.error, 90)}`);
  ok(hasCyr(as_.acc), 'qa article in Russian', `first150=${clip(as_.acc)}`);

  await sleep(25000);

  log('=== translate en ===');
  const ts = await call(hdr, '/api/ai/translate', { articleId: artId, lang: 'en' });
  const enWords = (ts.acc.toLowerCase().match(/\b(the|and|of|in|is|to|a|are|for)\b/g) || []).length;
  ok(ts.status === 200 && ts.acc.length > 30, 'translate en streams', `len=${ts.acc.length} err=${clip(ts.error, 90)}`);
  ok(enWords >= 3 || (!hasCyr(ts.acc) && ts.acc.length > 30), 'translate en is English', `first150=${clip(ts.acc)}`);

  log(fail === 0 ? 'ALL AI CHECKS PASSED' : `AI FAILURES: ${fail}`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => {
  console.error('SCRIPT FAIL', e);
  process.exit(2);
});
