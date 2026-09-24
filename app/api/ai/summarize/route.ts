import { createHash } from 'crypto';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getAISettings } from '@/lib/ai/settings';
import { estimateTokens, getAIClient, humanizeAiError } from '@/lib/ai/client';
import { buildSummarizePrompt } from '@/lib/ai/prompts';
import { logUsage } from '@/lib/ai/log';
import { guardPublic, isNextResponse, badRequest, notFound } from '@/lib/ai/guard';
import { sseStream } from '@/lib/ai/stream';
import { stripHtml } from '@/lib/utils';

const Body = z.object({
  articleId: z.string().min(1),
  refresh: z.boolean().optional(),
});

function parseKeyFacts(text: string): string[] {
  const facts: string[] = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = /^[-•]\s*(.+)$/.exec(line);
    if (match) facts.push(match[1].trim());
  }
  return facts;
}

export async function POST(req: Request): Promise<Response> {
  const guard = await guardPublic(req);
  if (isNextResponse(guard)) return guard;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Ожидается тело {articleId}');

  const { articleId, refresh } = parsed.data;
  const article = await db.article.findUnique({ where: { id: articleId } });
  if (!article || article.status !== 'published') {
    return notFound('Статья не найдена или не опубликована');
  }

  const settings = await getAISettings();
  const contentHash = createHash('sha256').update(article.content).digest('hex');

  if (!refresh) {
    const cached = await db.aISummaryCache.findUnique({
      where: { articleId_contentHash: { articleId, contentHash } },
    });
    if (cached) {
      let keyFacts: string[] = [];
      try {
        keyFacts = (JSON.parse(cached.keyFacts) as unknown[]).filter(
          (v): v is string => typeof v === 'string',
        );
      } catch {
        keyFacts = [];
      }
      return sseStream(req, async (ctl) => {
        ctl.delta(cached.summary);
        ctl.done({ keyFacts, cached: true });
        await logUsage({
          userId: guard.userId,
          feature: 'summarize',
          model: settings.model,
          durationMs: 0,
          status: 'ok',
          articleId,
          logEnabled: settings.logEnabled,
        });
      });
    }
  }

  const system = await buildSummarizePrompt(stripHtml(article.content));
  const client = await getAIClient();
  const started = Date.now();
  let acc = '';

  return sseStream(req, async (ctl, signal) => {
    try {
      const stream = await client.chat.completions.create(
        {
          model: settings.model,
          temperature: settings.temperature,
          max_tokens: settings.maxTokens,
          stream: true,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: 'Сделай краткий пересказ и список ключевых фактов.' },
          ],
        },
        { signal },
      );
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
      const keyFacts = parseKeyFacts(acc);
      try {
        await db.aISummaryCache.upsert({
          where: { articleId_contentHash: { articleId, contentHash } },
          create: { articleId, contentHash, summary: acc, keyFacts: JSON.stringify(keyFacts) },
          update: { summary: acc, keyFacts: JSON.stringify(keyFacts) },
        });
      } catch {
        // кэш не критичен
      }
      ctl.done({ keyFacts, cached: false });
      await logUsage({
        userId: guard.userId,
        feature: 'summarize',
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
        feature: 'summarize',
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
