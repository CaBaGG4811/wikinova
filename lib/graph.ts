import { db } from '@/lib/db';
import { stripHtml } from '@/lib/utils';

export interface GraphNode {
  id: string;
  slug: string;
  title: string;
  color: string;
  category: string;
}

export interface GraphLink {
  source: string;
  target: string;
  weight: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

const MAX_NODES = 100;
const EDGE_THRESHOLD = 3;

export async function buildKnowledgeGraph(categorySlug?: string): Promise<GraphData> {
  const where = { status: 'published' as const };
  const articles = await db.article.findMany({
    where,
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      content: true,
      categoryId: true,
      category: { select: { slug: true, name: true, color: true } },
      tags: { select: { tagId: true, tag: { select: { name: true } } } },
    },
    orderBy: [{ views: 'desc' }, { publishedAt: 'desc' }],
    take: MAX_NODES,
  });

  const filtered = categorySlug
    ? articles.filter((a) => a.category?.slug === categorySlug)
    : articles;

  const nodes: GraphNode[] = filtered.map((a) => ({
    id: a.id,
    slug: a.slug,
    title: a.title,
    color: a.category?.color ?? '#166534',
    category: a.category?.name ?? 'Без категории',
  }));

  const links: GraphLink[] = [];

  for (let i = 0; i < filtered.length; i++) {
    for (let j = i + 1; j < filtered.length; j++) {
      const a = filtered[i];
      const b = filtered[j];
      let weight = 0;

      const tagsA = new Set(a.tags.map((t) => t.tagId));
      for (const t of b.tags) {
        if (tagsA.has(t.tagId)) weight += 3;
      }

      if (a.categoryId === b.categoryId && a.categoryId) weight += 1;

      const wordsA = words(a);
      const wordsB = words(b);
      for (const w of wordsA) {
        if (wordsB.has(w)) weight += 1;
      }

      if (weight >= EDGE_THRESHOLD) {
        links.push({ source: a.id, target: b.id, weight });
      }
    }
  }

  const linked = new Set<string>();
  for (const l of links) {
    linked.add(String(l.source));
    linked.add(String(l.target));
  }

  const finalNodes = linked.size > 0
    ? nodes.filter((n) => linked.has(n.id))
    : nodes.slice(0, Math.min(30, nodes.length));

  return { nodes: finalNodes, links };
}

function words(a: { title: string; excerpt: string; content: string }): Set<string> {
  const plain = stripHtml(`${a.title} ${a.excerpt} ${a.content.slice(0, 2000)}`).toLowerCase();
  const list = plain
    .split(/[^0-9a-zа-яё]+/gi)
    .map((w) => w.trim())
    .filter((w) => w.length >= 5);
  return new Set(list.slice(0, 60));
}

export async function graphCategories(): Promise<{ slug: string; name: string }[]> {
  return db.category.findMany({
    where: { articles: { some: { status: 'published' } } },
    select: { slug: true, name: true },
    orderBy: { name: 'asc' },
  });
}
