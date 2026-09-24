import { z } from 'zod';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { db } from '@/lib/db';
import { getAISettings } from '@/lib/ai/settings';
import { estimateTokens, getAIClient, humanizeAiError } from '@/lib/ai/client';
import { buildTranslatePrompt } from '@/lib/ai/prompts';
import { logUsage } from '@/lib/ai/log';
import { guardPublic, isNextResponse, badRequest, notFound } from '@/lib/ai/guard';
import { sseStream } from '@/lib/ai/stream';

const Body = z.object({
  articleId: z.string().min(1),
  lang: z.string().min(2).max(12),
});

export async function POST(req: Request): Promise<Response> {
  const guard = await guardPublic(req);
  if (isNextResponse(guard)) return guard;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Ожидается {articleId, lang}');

  const { articleId, lang } = parsed.data;
  const article = await db.article.findUnique({ where: { id: articleId } });
  if (!article) return notFound('Статья не найдена');

  const settings = await getAISettings();
  const langCode = lang.toLowerCase();

  const cached = await db.articleTranslation.findUnique({
    where: { articleId_lang: { articleId, lang: langCode } },
  });
  if (cached) {
    return sseStream(req, async (ctl) => {
      ctl.delta(cached.content);
      ctl.done({ lang: langCode, cached: true });
      await logUsage({
        userId: guard.userId,
        feature: 'translate',
        model: settings.model,
        durationMs: 0,
        status: 'ok',
        articleId,
        logEnabled: settings.logEnabled,
      });
    });
  }

  const system = await buildTranslatePrompt({
    lang: langCode,
    title: article.title,
    content: article.content,
  });
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: system },
    { role: 'user', content: `Переведи текст статьи на ${langCode}. Сохрани HTML-разметку как есть.` },
  ];
  const client = await getAIClient();
  const started = Date.now();

  return sseStream(req, async (ctl, signal) => {
    try {
      const stream = await client.chat.completions.create(
        {
          model: settings.model,
          temperature: Math.min(settings.temperature, 0.5),
          max_tokens: settings.maxTokens,
          stream: true,
          messages,
        },
        { signal },
      );
      let acc = '';
      let reasoningBuffer = '';
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        const content = typeof delta?.content === 'string' ? delta.content : '';
        if (content) {
          acc += content;
          ctl.delta(content);
          continue;
        }
        const d = delta as { reasoning_content?: unknown } | undefined;
        const reasoning = typeof d?.reasoning_content === 'string' ? d.reasoning_content : '';
        if (reasoning) reasoningBuffer += reasoning;
      }
      if (!acc && reasoningBuffer) {
        acc = reasoningBuffer;
        ctl.delta(reasoningBuffer);
      }
      // title сохраняем: по решению слоя оставляем оригинал (переводится только контент)
      const title = article.title;
      try {
        await db.articleTranslation.upsert({
          where: { articleId_lang: { articleId, lang: langCode } },
          create: { articleId, lang: langCode, title, content: acc, isMachine: true },
          update: { title, content: acc, isMachine: true },
        });
      } catch {
        // кэш перевода не критичен
      }
      ctl.done({ lang: langCode, cached: false });
      await logUsage({
        userId: guard.userId,
        feature: 'translate',
        model: settings.model,
        tokensIn: estimateTokens(system),
        tokensOut: estimateTokens(acc),
        durationMs: Date.now() - started,
        status: 'ok',
        articleId,
        logEnabled: settings.logEnabled,
      });
    } catch (err) {
      await logUsage({
        userId: guard.userId,
        feature: 'translate',
        model: settings.model,
        durationMs: Date.now() - started,
        status: 'error',
        errorMsg: humanizeAiError(err),
        articleId,
        logEnabled: settings.logEnabled,
      });
      throw err;
    }
  });
}
