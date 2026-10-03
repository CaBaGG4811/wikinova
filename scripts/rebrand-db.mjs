import { createClient } from '@libsql/client';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const client = createClient({ url, authToken: process.env.DB_AUTH_TOKEN });

const targets = [
  ['SiteBlock', 'value'],
  ['AIPrompt', 'template'],
];

for (const [table, col] of targets) {
  try {
    const res = await client.execute(
      `UPDATE "${table}" SET "${col}" = REPLACE("${col}", 'WikiNova', 'ГАЛИЛЕО') WHERE "${col}" LIKE '%WikiNova%'`,
    );
    console.log(`${table}.${col}: updated ${res.rowsAffected} row(s)`);
  } catch (err) {
    console.error(`${table}.${col}: failed`, err instanceof Error ? err.message : err);
  }
}

client.close();
