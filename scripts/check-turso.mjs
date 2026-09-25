import { createClient } from '@libsql/client';

const c = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

for (const t of ['User', 'Article', 'SiteBlock', 'AIPrompt', 'AISettings', 'Collection', 'Category']) {
  const r = await c.execute(`SELECT COUNT(*) AS n FROM "${t}"`);
  console.log(t, String(r.rows[0].n));
}
const a = await c.execute('SELECT email, role FROM User LIMIT 3');
console.log('users:', JSON.stringify(a.rows));
const art = await c.execute('SELECT slug, status FROM Article LIMIT 3');
console.log('articles:', JSON.stringify(art.rows));
c.close();
