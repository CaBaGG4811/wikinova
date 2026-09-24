import { db } from '@/lib/db';

export const BLOCK_DEFAULTS: Record<string, string> = {
  // Главная
  'home.hero.title': 'Знание без границ',
  'home.hero.subtitle': 'Современная энциклопедия с AI-ассистентом',
  'home.hero.cta.text': 'Начать чтение',
  'home.featured.title': 'Избранные статьи',
  'home.fresh.title': 'Свежее',
  'home.categories.title': 'Категории',
  'home.request.cta': 'Не нашли статью? Закажите её',

  // О сайте
  'about.title': 'О проекте WikiNova',
  'about.body':
    'WikiNova — это локальная энциклопедия нового поколения: статьи лежат на вашем сервере, читать и дополнять их можно без внешних сервисов. Проект собран как редакция, а не как лента новостей: у каждой темы есть автор, статус и история правок.',

  // Контакты
  'contact.title': 'Связаться с нами',
  'contact.body':
    'Если у вас есть вопросы, предложения или вы нашли ошибку, напишите редакции. Отвечаем на письма о статьях, фактических ошибках и заявках на новые темы.',
  'contact.email': 'hello@wikinova.local',

  // Правила
  'rules.title': 'Правила WikiNova',
  'rules.body':
    'WikiNova — свободная энциклопедия. Держитесь на спокойном энциклопедическом тоне: правила короткие, но обязательные, они защищают читателя от шума и помогают редакторам договариваться.',

  // Футер
  'footer.copyright': '© WikiNova, 2026',
  'footer.tagline': 'Знание без границ',

  // Заявки
  'request.title': 'Заказать статью',
  'request.subtitle': 'Опишите, какую статью вы хотели бы видеть',
};

export const BLOCK_KEYS = Object.keys(BLOCK_DEFAULTS);

export function isBlockKey(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(BLOCK_DEFAULTS, key);
}

export async function getBlock(key: string): Promise<string> {
  if (!isBlockKey(key)) return '';
  try {
    const row = await db.siteBlock.findUnique({ where: { key } });
    if (row) return row.value;
  } catch {
    return BLOCK_DEFAULTS[key] || '';
  }
  return BLOCK_DEFAULTS[key] || '';
}

export async function getBlocks(keys: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(keys.filter((k) => isBlockKey(k)))].slice(0, 50);
  const out: Record<string, string> = {};
  if (unique.length === 0) return out;

  try {
    const rows = await db.siteBlock.findMany({ where: { key: { in: unique } } });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    for (const k of unique) {
      out[k] = map.get(k) ?? BLOCK_DEFAULTS[k] ?? '';
    }
  } catch {
    for (const k of unique) {
      out[k] = BLOCK_DEFAULTS[k] ?? '';
    }
  }
  return out;
}
