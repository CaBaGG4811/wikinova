import { z } from 'zod';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { RagSource } from '@/types';
import { getAISettings } from '@/lib/ai/settings';
import { estimateTokens, getAIClient, humanizeAiError } from '@/lib/ai/client';
import { buildQaGlobalPrompt } from '@/lib/ai/prompts';
import { logUsage } from '@/lib/ai/log';
import { guardPublic, isNextResponse, badRequest } from '@/lib/ai/guard';
import { sseStream } from '@/lib/ai/stream';
import { searchRelevant } from '@/lib/ai/rag';

const Body = z.object({
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

const NO_RESULTS_TEXT =
  'В базе вики нет статей по этому запросу. Могу создать заявку: /request.';

export async function POST(req: Request): Promise<Response> {
  const guard = await guardPublic(req);
  if (isNextResponse(guard)) return guard;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Ожидается {messages[]}');

  const messages = parsed.data.messages;
  let lastUser = '';
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m.role === 'user' && m.content.trim()) {
      lastUser = m.content.trim();
      break;
    }
  }
  if (!lastUser) return badRequest('Нет вопроса пользователя');

  const settings = await getAISettings();
  const hits = await searchRelevant(lastUser, 8);

  if (!hits.length) {
    return sseStream(req, async (ctl) => {
      ctl.delta(NO_RESULTS_TEXT);
      ctl.done({ sources: [] as RagSource[] });
      await logUsage({
        userId: guard.userId,
        feature: 'qa_global',
        model: settings.model,
        tokensIn: estimateTokens(lastUser),
        tokensOut: estimateTokens(NO_RESULTS_TEXT),
        durationMs: 0,
        status: 'ok',
        logEnabled: settings.logEnabled,
      });
    });
  }

  const context = hits
    .map((h) => `### ${h.title} (${h.slug})\n${h.excerpt}\n${h.contentSnippet}`)
    .join('\n\n');
  const system = await buildQaGlobalPrompt(context);
  const history: ChatCompletionMessageParam[] = messages.map((m) =>
    m.role === 'user'
      ? { role: 'user' as const, content: m.content }
      : { role: 'assistant' as const, content: m.content },
  );
  const chatMessages: ChatCompletionMessageParam[] = [
    { role: 'system' as const, content: system },
    ...history,
  ];

  const sources: RagSource[] = hits.slice(0, 4).map(({ id, slug, title, excerpt }) => ({
    id,
    slug,
    title,
    excerpt,
  }));

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
      ctl.done({ sources });
      await logUsage({
        userId: guard.userId,
        feature: 'qa_global',
        model: settings.model,
        tokensIn: estimateTokens(system + lastUser),
        tokensOut: estimateTokens(acc),
        durationMs: Date.now() - started,
        status: 'ok',
        logEnabled: settings.logEnabled,
      });
    } catch (err) {
      await logUsage({
        userId: guard.userId,
        feature: 'qa_global',
        model: settings.model,
        durationMs: Date.now() - started,
        status: 'error',
        errorMsg: humanizeAiError(err),
        logEnabled: settings.logEnabled,
      });
      throw err;
    }
  });
}
