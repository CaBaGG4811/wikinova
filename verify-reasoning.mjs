import { readFileSync } from 'fs';

const B = 'http://localhost:3001';
const log = console.log;

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
  const ck = c.headers
    .getSetCookie()
    .map((x) => x.split(';')[0])
    .join('; ');
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
      // ignore partial
    }
  }
  return { acc, done, error, bytes: text.length };
}

const clip = (s, n = 260) => JSON.stringify(String(s || '').slice(0, n));

(async () => {
  let fail = 0;
  const ok = (cond, name, extra = '') => {
    if (cond) log(`PASS ${name} ${extra}`);
    else {
      fail++;
      log(`FAIL ${name} ${extra}`);
    }
  };

  const env = readFileSync(new URL('./.env', import.meta.url), 'utf8');
  const key = (env.match(/^AI_API_KEY=(.*)$/m) || [, ''])[1].trim();

  // --- 0) raw LM Studio probe: what does the model actually return? ---
  try {
    const pr = await fetch('http://localhost:1234/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemma-4-12b-qat',
        messages: [{ role: 'user', content: 'Ответь одним словом: привет' }],
        max_tokens: 80,
      }),
    });
    const pd = await pr.json();
    const msg = pd.choices?.[0]?.message;
    log(`RAW status=${pr.status} messageKeys=${JSON.stringify(Object.keys(msg || {}))}`);
    log(`RAW content=${clip(msg?.content)}`);
    log(`RAW reasoning_content=${clip(msg?.reasoning_content)}`);
  } catch (e) {
    log(`RAW probe ERR ${e.message}`);
  }

  // --- 1) login as admin, check runtime settings (maxTokens clamp) ---
  const ck = await session('admin@wikinova.local', 'admin123');
  const hdr = { cookie: ck, 'content-type': 'application/json' };

  const st = await j(await fetch(`${B}/api/admin/ai/settings`, { headers: hdr }));
  ok(
    st && Number(st.maxTokens) >= 4096,
    'runtime maxTokens >= 4096',
    `maxTokens=${st?.maxTokens} baseUrl=${st?.baseUrl} hasKey=${st?.hasApiKey}`,
  );

  // --- 2) Draft (non-streaming, needs pickMessageText) ---
  const dr = await fetch(`${B}/api/ai/draft`, {
    method: 'POST',
    headers: hdr,
    body: JSON.stringify({
      topic: 'Квантовая запутанность',
      level: 'стандарт',
      style: 'энциклопедический',
    }),
  });
  const dd = await j(dr);
  ok(
    dr.status === 200 && dd?.title && dd?.content,
    'draft returns title+content',
    `status=${dr.status} title=${clip(dd?.title, 80)} content=${clip(dd?.content)} error=${clip(dd?.error, 160)}`,
  );

  // --- 3) Summarize (SSE) ---
  const list = await j(await fetch(`${B}/api/articles?pageSize=1`));
  const artId = list?.items?.[0]?.id;
  const sr = await fetch(`${B}/api/ai/summarize`, {
    method: 'POST',
    headers: hdr,
    body: JSON.stringify({ articleId: artId, refresh: true }),
  });
  const ss = await readSse(sr);
  ok(
    sr.status === 200 && !ss.error && ss.acc.trim().length > 50 && ss.done,
    'summarize SSE streams text',
    `status=${sr.status} len=${ss.acc.length} error=${clip(ss.error)} preview=${clip(ss.acc)}`,
  );

  // --- 4) QA global (SSE, needs RAG hits) ---
  const qr = await fetch(`${B}/api/ai/qa/global`, {
    method: 'POST',
    headers: hdr,
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Что такое квантовая запутанность?' }],
    }),
  });
  const qs = await readSse(qr);
  ok(
    qr.status === 200 && !qs.error && qs.acc.trim().length > 20 && qs.done && (qs.done.sources?.length ?? 0) > 0,
    'qa global SSE streams answer with sources',
    `status=${qr.status} len=${qs.acc.length} sources=${qs.done?.sources?.length} error=${clip(qs.error)} preview=${clip(qs.acc)}`,
  );

  log(fail === 0 ? 'ALL CHECKS PASSED' : `FAILURES: ${fail}`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => {
  console.error('SCRIPT FAIL', e);
  process.exit(2);
});
