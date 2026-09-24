import { db } from '@/lib/db';

export const ANTI_SLOP_SUFFIX =
  'Запрещено: длинное тире как замена знаков препинания; фразы "As an AI", "I\'m just a language model"; buzzwords elevate/unlock/seamlessly/effortlessly/empower/revolutionize. Отвечай на языке запроса. Не выдумывай источники. Отвечай сразу, без размышлений и chain-of-thought. Не пиши reasoning. Сразу давай финальный ответ. КРИТИЧНО: Отвечай на языке пользователя. Если контекст на русском — весь ответ, включая рассуждения, на русском. Не переключайся на английский.';

export const DEFAULT_PROMPTS: Record<string, string> = {
  summarize: `Ты редактор энциклопедии. Сделай сжатый пересказ статьи ниже.
Требования:
- 3-5 предложений, нейтральный тон, без воды.
- Затем список 3-6 ключевых фактов (bullets).
- Не выдумывай факты, которых нет в тексте.
- Язык ответа - язык статьи.
Язык ответа: русский (если контекст на русском).
Статья:
"""
{content}
"""`,
  qa_article: `Ты ассистент энциклопедии WikiNova. Отвечай на вопросы пользователя О ТЕКУЩЕЙ СТАТЬЕ.
Правила:
- Если ответ есть в статье - цитируй по смыслу, ссылайся на абзац.
- Если ответа в статье нет, но ты знаешь - явно начни с "Это не из статьи, но по общим знаниям: ".
- Если не знаешь - скажи честно.
- Не используй фразы "As an AI", "I'm just a language model".
Язык ответа: русский (если контекст на русском).
Статья:
"""
{content}
"""`,
  qa_global: `Ты ассистент энциклопедии WikiNova. Отвечай ТОЛЬКО на основе фрагментов из статей ниже.
Правила:
- Ссылайся на статьи по названию.
- Если фрагментов недостаточно - честно скажи, что в вики нет ответа, и предложи создать заявку.
- Язык ответа - язык пользователя.
Язык ответа: русский (если контекст на русском).
Фрагменты:
"""
{context}
"""`,
  draft: `Ты редактор энциклопедии. Напиши черновик статьи на тему: {topic}.
Стиль: нейтральный энциклопедический. Без маркетинговых оборотов.
Структура: введение (2-3 абзаца) + разделы H2.
Опирайся на фрагменты существующих статей вики ниже, где это уместно.
В конце добавь раздел "## Требует проверки" со списком утверждений, которые нужно подтвердить источниками.
Ключевые пункты: {points}
Уровень детализации: {level}
Язык ответа: русский (если контекст на русском).
Существующие материалы:
"""
{rag_context}
"""`,
  improve: `Ты редактор энциклопедии. Перепиши выделенный текст по режиму: {mode}.
Сохраняй смысл, фактность и язык оригинала. Без рекламных оборотов.
Язык ответа: русский (если контекст на русском).
Текст:
"""
{text}
"""`,
  translate: `Переведи статью на язык: {lang}. Сохрани разметку HTML. Язык перевода: {lang}.
Язык ответа: русский (если контекст на русском). При переводе отвечай строго на языке: {lang}.
Заголовок: {title}
Текст:
"""
{content}
"""`,
  factcheck: `Ты факт-чекер энциклопедии. Выдели 4-8 ключевых утверждений-фактов из статьи.
Для каждого укажи вердикт по другим статьям вики (если есть контекст) и краткое пояснение.
Ответь строго JSON массивом объектов: [{"claim": "...", "verdict": "confirmed|not_found|conflict", "note": "..."}]
Язык ответа: русский (если контекст на русском).
Статья:
"""
{content}
"""`,
  metadata: `На основе текста статьи предложи метаданные. Ответь строго JSON:
{"title": "...", "description": "...", "slug": "...", "excerpt": "...", "tags": ["..."], "category": "slug-одной-из-категорий"}
Язык ответа: русский (если контекст на русском).
Текст:
"""
{content}
"""`,
};

export async function getPromptTemplate(key: string): Promise<string> {
  try {
    const row = await db.aIPrompt.findFirst({
      where: { key, isActive: true },
      orderBy: { version: 'desc' },
    });
    if (row?.template) return row.template;
  } catch {
    // fallback на встроенный шаблон
  }
  return DEFAULT_PROMPTS[key] ?? '';
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_m, name: string) => vars[name] ?? '');
}

async function build(key: string, vars: Record<string, string>): Promise<string> {
  const raw = await getPromptTemplate(key);
  return `${fill(raw, vars).trim()}\n\n${ANTI_SLOP_SUFFIX}`;
}

export function buildSummarizePrompt(content: string): Promise<string> {
  return build('summarize', { content });
}

export function buildQaArticlePrompt(content: string): Promise<string> {
  return build('qa_article', { content });
}

export function buildQaGlobalPrompt(context: string): Promise<string> {
  return build('qa_global', { context });
}

export async function buildDraftPrompt(v: {
  topic: string;
  points: string;
  level: string;
  style: string;
  ragContext: string;
}): Promise<string> {
  const raw = await getPromptTemplate('draft');
  let filled = fill(raw, {
    topic: v.topic,
    points: v.points,
    level: v.level,
    style: v.style,
    rag_context: v.ragContext,
  });
  if (!raw.includes('{style}') && v.style) {
    filled += `\nСтиль изложения: ${v.style}.`;
  }
  return `${filled.trim()}\n\n${ANTI_SLOP_SUFFIX}`;
}

export function buildImprovePrompt(mode: string, text: string): Promise<string> {
  return build('improve', { mode, text });
}

export function buildTranslatePrompt(v: { lang: string; title: string; content: string }): Promise<string> {
  return build('translate', v);
}

export function buildFactCheckPrompt(content: string): Promise<string> {
  return build('factcheck', { content });
}

export async function buildMetadataPrompt(
  content: string,
  extra?: { existingTags?: string[]; categories?: string[] },
): Promise<string> {
  const base = await build('metadata', { content });
  const tags = extra?.existingTags ?? [];
  const categories = extra?.categories ?? [];
  const lines: string[] = [];
  if (tags.length) lines.push(`Существующие теги (используй точные имена, где уместно): ${tags.join(', ')}`);
  if (categories.length) lines.push(`Существующие категории (выбери slug одной): ${categories.join(', ')}`);
  if (!lines.length) return base;
  return `${base}\n${lines.join('\n')}`;
}
