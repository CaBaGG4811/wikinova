import { z } from 'zod';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { db } from '@/lib/db';
import { getAISettings } from '@/lib/ai/settings';
import { estimateTokens, getAIClient, humanizeAiError } from '@/lib/ai/client';
import { buildQaArticlePrompt } from '@/lib/ai/prompts';
import { logUsage } from '@/lib/ai/log';
import { guardPublic, isNextResponse, badRequest, notFound } from '@/lib/ai/guard';
import { sseStream } from '@/lib/ai/stream';
import { stripHtml } from '@/lib/utils';

const Body = z.object({
  articleId: z.string().min(1),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(8000),
      }),
    )
    .min(1)
    .max(40),
});

export async function POST(req: Request): Promise<Response> {
  const guard = await guardPublic(req);
  if (isNextResponse(guard)) return guard;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Ожидается {articleId, messages[]}');

  const { articleId, messages } = parsed.data;
  const article = await db.article.findUnique({ where: { id: articleId } });
  if (!article) return notFound('Статья не найдена');

  const settings = await getAISettings();
  const system = await buildQaArticlePrompt(stripHtml(article.content).slice(0, 8000));
  const history: ChatCompletionMessageParam[] = messages.map((m) =>
    m.role === 'user'
      ? { role: 'user' as const, content: m.content }
      : { role: 'assistant' as const, content: m.content },
  );
  const chatMessages: ChatCompletionMessageParam[] = [{ role: 'system' as const, content: system }, ...history];

  const client = await getAIClient();
  const started = Date.now();

  return sseStream(req, async (ctl, signal) => {
    try {
      const stream = await client.chat.completions.create(
        {
          model: settings.model,
          temperature: settings.temperature,
          max_tokens: settings.maxTokens,
          stream: true,
          messages: chatMessages,
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
      ctl.done({});
      await logUsage({
        userId: guard.userId,
        feature: 'qa_article',
        model: settings.model,
        tokensIn: estimateTokens(chatMessages.map((m) => String(m.content ?? '')).join(' ')),
        tokensOut: estimateTokens(acc),
        durationMs: Date.now() - started,
        status: 'ok',
        articleId,
        logEnabled: settings.logEnabled,
      });
    } catch (err) {
      await logUsage({
        userId: guard.userId,
        feature: 'qa_article',
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
