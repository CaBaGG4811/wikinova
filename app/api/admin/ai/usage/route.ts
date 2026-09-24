import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { guardEditor, isNextResponse } from '@/lib/ai/guard';

type RangeKey = '24h' | '7d' | '30d';

const RANGES: Record<RangeKey, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function bucketKey(date: Date, range: RangeKey): string {
  const day = `${pad(date.getDate())}.${pad(date.getMonth() + 1)}`;
  if (range === '24h') return `${day} ${pad(date.getHours())}:00`;
  if (range === '7d') return day;
  return `${pad(date.getMonth() + 1)}.${String(date.getFullYear()).slice(2)}`;
}

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request): Promise<Response> {
  const guard = await guardEditor();
  if (isNextResponse(guard)) return guard;

  const url = new URL(req.url);
  const rangeParam = url.searchParams.get('range');
  const range: RangeKey = rangeParam === '7d' || rangeParam === '30d' ? rangeParam : '24h';
  const feature = url.searchParams.get('feature')?.trim() || '';
  const format = url.searchParams.get('format') === 'csv' ? 'csv' : 'json';

  const since = new Date(Date.now() - RANGES[range]);
  const rows = await db.aIUsage.findMany({
    where: {
      createdAt: { gte: since },
      ...(feature ? { feature } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: format === 'csv' ? 5000 : 100,
  });

  if (format === 'csv') {
    const header = ['createdAt', 'feature', 'model', 'tokensIn', 'tokensOut', 'durationMs', 'status', 'errorMsg', 'userId', 'articleId'];
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push(
        [
          r.createdAt.toISOString(),
          r.feature,
          r.model,
          r.tokensIn,
          r.tokensOut,
          r.durationMs,
          r.status,
          r.errorMsg ?? '',
          r.userId ?? '',
          r.articleId ?? '',
        ]
          .map(csvEscape)
          .join(','),
      );
    }
    return new Response(`${lines.join('\r\n')}\r\n`, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="ai-usage-${range}.csv"`,
        'Cache-Control': 'no-cache',
      },
    });
  }

  const all = await db.aIUsage.findMany({
    where: {
      createdAt: { gte: since },
      ...(feature ? { feature } : {}),
    },
    select: { tokensIn: true, tokensOut: true, durationMs: true, status: true },
  });

  const requests = all.length;
  const tokensIn = all.reduce((sum, r) => sum + r.tokensIn, 0);
  const tokensOut = all.reduce((sum, r) => sum + r.tokensOut, 0);
  const avgMs = requests ? Math.round(all.reduce((sum, r) => sum + r.durationMs, 0) / requests) : 0;
  const errors = all.filter((r) => r.status === 'error').length;

  const buckets = new Map<string, { date: string; requests: number; tokensOut: number }>();
  const chartRows = await db.aIUsage.findMany({
    where: { createdAt: { gte: since }, ...(feature ? { feature } : {}) },
    select: { createdAt: true, tokensOut: true },
    orderBy: { createdAt: 'asc' },
  });
  for (const r of chartRows) {
    const key = bucketKey(r.createdAt, range);
    const entry = buckets.get(key) ?? { date: key, requests: 0, tokensOut: 0 };
    entry.requests += 1;
    entry.tokensOut += r.tokensOut;
    buckets.set(key, entry);
  }
  // пропуски в бакетах (нет запросов) не рисуем: пустые интервалы просто отсутствуют

  return NextResponse.json({
    totals: { requests, tokensIn, tokensOut, avgMs, errors },
    chart: Array.from(buckets.values()),
    rows,
  });
}
