// Перенос данных из локального SQLite в облачную базу Turso (libSQL).
// Запуск: node scripts/migrate-to-turso.mjs
// Нужны переменные: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN (или DB_AUTH_TOKEN)
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@libsql/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { PrismaClient } from '@prisma/client';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || '';
const authToken = process.env.TURSO_AUTH_TOKEN || process.env.DB_AUTH_TOKEN;

if (!url || url.startsWith('file:')) {
  console.error('Укажите TURSO_DATABASE_URL (libsql://... или https://...)');
  process.exit(1);
}

// Порядок важен: сначала таблицы без зависимостей
const MODELS = [
  'user',
  'category',
  'tag',
  'articleRequest',
  'article',
  'articleTag',
  'articleRating',
  'collection',
  'collectionItem',
  'media',
  'articleVersion',
  'articleLike',
  'bookmark',
  'activityLog',
  'aISettings',
  'aIPrompt',
  'aIUsage',
  'aISummaryCache',
  'articleTranslation',
  'siteBlock',
].filter((m, i, arr) => arr.indexOf(m) === i);

const src = new PrismaClient();
const remote = createClient({ url, authToken });
const dst = new PrismaClient({ adapter: new PrismaLibSQL(remote) });

const ddlPath = join(root, 'prisma', 'turso-init.sql');
if (!existsSync(ddlPath)) {
  console.error('Не найден prisma/turso-init.sql');
  process.exit(1);
}
const ddl = readFileSync(ddlPath, 'utf8');

console.log('1) Создаю схему в Turso...');
const statements = ddl
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.startsWith('--'));
for (const stmt of statements) {
  try {
    await remote.execute(stmt);
  } catch (e) {
    if (/already exists/i.test(e.message)) continue;
    throw e;
  }
}

console.log('2) Копирую данные...');
let total = 0;
for (const model of MODELS) {
  let rows = [];
  try {
    rows = await src[model].findMany();
  } catch (e) {
    console.log(`  ${model}: пропущено (${e.message.slice(0, 60)})`);
    continue;
  }
  if (rows.length === 0) {
    console.log(`  ${model}: 0`);
    continue;
  }
  for (const row of rows) {
    await dst[model].create({ data: row });
  }
  total += rows.length;
  console.log(`  ${model}: ${rows.length}`);
}

console.log(`Готово. Перенесено записей: ${total}`);
await src.$disconnect();
await dst.$disconnect();
remote.close();
