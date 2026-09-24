import { db } from '@/lib/db';
import { getAISettings } from '@/lib/ai/settings';

export interface LogUsageInput {
  userId?: string | null;
  feature: string;
  model: string;
  tokensIn?: number;
  tokensOut?: number;
  durationMs?: number;
  status: 'ok' | 'error';
  errorMsg?: string | null;
  articleId?: string | null;
  logEnabled?: boolean;
}

export async function logUsage(input: LogUsageInput): Promise<void> {
  try {
    let enabled = input.logEnabled;
    if (enabled === undefined) {
      const settings = await getAISettings();
      enabled = settings.logEnabled;
    }
    if (!enabled) return;
    await db.aIUsage.create({
      data: {
        userId: input.userId ?? null,
        feature: input.feature,
        model: input.model,
        tokensIn: input.tokensIn ?? 0,
        tokensOut: input.tokensOut ?? 0,
        durationMs: input.durationMs ?? 0,
        status: input.status,
        errorMsg: input.errorMsg ?? null,
        articleId: input.articleId ?? null,
      },
    });
  } catch {
    // логирование не должно ломать пользовательский сценарий
  }
}
