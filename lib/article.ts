import type { Prisma } from '@prisma/client';
import type { TocItem } from '@/types';
import { slugify } from '@/lib/utils';

export const cardInclude = {
  author: { select: { id: true, name: true } },
  category: { select: { slug: true, name: true, color: true } },
  tags: { select: { tag: { select: { slug: true, name: true } } } },
  _count: { select: { likes: true } },
} satisfies Prisma.ArticleInclude;

export function spStr(v: string | string[] | undefined): string | undefined {
  return typeof v === 'string' && v ? v : undefined;
}

export function buildTocWithIds(html: string): { html: string; toc: TocItem[] } {
  const toc: TocItem[] = [];
  const used = new Map<string, number>();
  const out = html.replace(
    /<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi,
    (match: string, levelStr: string, attrs: string, inner: string) => {
      const text = inner.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (!text) return match;
      const level = Number(levelStr);
      let id = slugify(text);
      const seen = used.get(id) ?? 0;
      used.set(id, seen + 1);
      if (seen > 0) id = `${id}-${seen + 1}`;
      toc.push({ id, text, level });
      const cleanAttrs = attrs.replace(/\s*id\s*=\s*("[^"]*"|'[^']*')/gi, '');
      return `<h${level}${cleanAttrs} id="${id}">${inner}</h${level}>`;
    },
  );
  return { html: out, toc };
}

export function parseSources(excerpt: string): string[] {
  const m = excerpt.match(/Источники\s*[:：]\s*([\s\S]+)/i);
  if (!m || !m[1]) return [];
  return m[1]
    .split(/[\n;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);
}
