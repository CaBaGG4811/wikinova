import { searchArticles } from '@/lib/search';

export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') ?? '';
  const limit = Number(searchParams.get('limit') ?? '20') || 20;
  const { items, total } = await searchArticles(q, limit);
  return Response.json({ items, total });
}
