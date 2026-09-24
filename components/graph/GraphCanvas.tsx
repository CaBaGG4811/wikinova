'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { GraphData, GraphLink, GraphNode } from '@/lib/graph';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[480px] items-center justify-center text-sm text-muted">
      Загружаем карту знаний…
    </div>
  ),
});

interface Props {
  data: GraphData;
  categories: { slug: string; name: string }[];
  activeCategory: string;
}

interface FgNode extends GraphNode {
  x?: number;
  y?: number;
}

export function GraphCanvas({ data, categories, activeCategory }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<GraphNode | null>(null);

  const [nodes, setNodes] = useState<FgNode[]>(() => data.nodes as FgNode[]);
  const [links, setLinks] = useState<GraphLink[]>(data.links);

  useEffect(() => {
    setNodes(data.nodes as FgNode[]);
    setLinks(data.links);
    setSelected(null);
  }, [data]);

  const legend = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of data.nodes) map.set(n.category, n.color);
    return Array.from(map.entries());
  }, [data.nodes]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <a
          href="/graph"
          className={`badge transition-colors duration-150 ${!activeCategory ? 'border-primary/50 text-primary' : 'hover:border-ink/40'}`}
        >
          Все
        </a>
        {categories.map((c) => (
          <a
            key={c.slug}
            href={`/graph?category=${c.slug}`}
            className={`badge transition-colors duration-150 ${activeCategory === c.slug ? 'border-primary/50 text-primary' : 'hover:border-ink/40'}`}
          >
            {c.name}
          </a>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="h-[480px] w-full bg-surface">
          <ForceGraph2D
            graphData={{ nodes, links }}
            nodeId="id"
            nodeLabel="title"
            nodeColor={(node) => (node as FgNode).color ?? '#166534'}
            nodeRelSize={6}
            linkColor={() => 'rgba(28,25,23,0.18)'}
            linkWidth={(link) => Math.min(3, 1 + ((link as GraphLink).weight ?? 1) / 6)}
            backgroundColor="#FBFAF8"
            onNodeClick={(node) => {
              const n = node as FgNode;
              setSelected(n);
              router.push(`/article/${n.slug}`);
            }}
            onBackgroundClick={() => setSelected(null)}
          />
        </div>
        <div className="border-t border-line px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            {legend.slice(0, 8).map(([name, color]) => (
              <span key={name} className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                {name}
              </span>
            ))}
          </div>
          <p className="text-xs text-muted">
            Узлы: {data.nodes.length} · Связи: {data.links.length}
            {selected ? ` · ${selected.title}` : ''}
          </p>
        </div>
      </div>

      <p className="text-caption text-muted">
        Клик по узлу открывает статью. Толщина связи отражает силу сходства (теги, категория, совпадения в тексте).
      </p>
    </div>
  );
}
