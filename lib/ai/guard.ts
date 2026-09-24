import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions, hasRole } from '@/lib/auth';
import { checkRateLimit, ipKey } from '@/lib/ai/rate-limit';

export interface GuardOk {
  userId: string | null;
}

export function clientIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip');
}

export function badRequest(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 400 });
}

export function notFound(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 404 });
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
}

export function forbidden(): NextResponse {
  return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
}

function rateLimited(retryAfter: number): NextResponse {
  const minutes = Math.max(1, Math.ceil(retryAfter / 60));
  return NextResponse.json(
    { error: `Слишком много AI-запросов. Попробуйте примерно через ${minutes} мин.`, retryAfter },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  );
}

export async function guardPublic(req: Request): Promise<GuardOk | NextResponse> {
  const session = await getServerSession(authOptions);
  const realUserId = session?.user?.id ?? null;
  const ip = clientIp(req);
  const result = await checkRateLimit(realUserId, ip);
  if (!result.ok) return rateLimited(result.retryAfter ?? 60);
  // Ключ логирования = ключ rate-limit: у анонимов — хеш IP (ip:<hash>), у пользователей — их id.
  // logUsage пишет его в AIUsage.userId, и checkRateLimit находит эти же записи.
  return { userId: realUserId ?? ipKey(ip) };
}

export async function guardEditor(): Promise<GuardOk | NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();
  if (!hasRole(session.user?.role, 'EDITOR')) return forbidden();
  return { userId: session.user.id };
}

export function isNextResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}
