import { createHash } from 'crypto';
import { db } from '@/lib/db';
import { getAISettings } from '@/lib/ai/settings';

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfter?: number;
}

export function ipKey(ip: string | null | undefined): string {
  const raw = (ip || 'unknown').trim() || 'unknown';
  const hash = createHash('sha256').update(raw).digest('hex').slice(0, 24);
  return `ip:${hash}`;
}

export async function checkRateLimit(userId: string | null, ip?: string | null): Promise<RateLimitResult> {
  const settings = await getAISettings();
  const key = userId ?? ipKey(ip);
  const since = new Date(Date.now() - 3600 * 1000);

  let rows: { createdAt: Date }[] = [];
  try {
    rows = await db.aIUsage.findMany({
      where: { userId: key, createdAt: { gte: since } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  } catch {
    return { ok: true, remaining: settings.rateLimitAnon };
  }

  const limit = userId ? settings.rateLimitUser : settings.rateLimitAnon;
  if (rows.length < limit) {
    return { ok: true, remaining: Math.max(0, limit - rows.length) };
  }

  const oldest = rows[0]?.createdAt ?? new Date();
  const retryAfter = Math.max(1, Math.ceil((oldest.getTime() + 3600 * 1000 - Date.now()) / 1000));
  return { ok: false, remaining: 0, retryAfter };
}
