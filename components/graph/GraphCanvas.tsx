'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

function seedNodes(raw: GraphNode[]): FgNode[] {
  const count = Math.max(raw.length, 1);
  return raw.map((n, i) => {
    const angle = (i / count) * Math.PI * 2;
    const radius = 60 + (i % 7) * 24;
    return {
      ...n,
      x: Math.cos(angle) * radius + ((i % 3) - 1) * 8,
      y: Math.sin(angle) * radius + ((i % 5) - 2) * 6,
    };
  });
}

export function GraphCanvas({ data, categories, activeCategory }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [dark, setDark] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);

  const [nodes, setNodes] = useState<FgNode[]>(() => seedNodes(data.nodes));
  const [links, setLinks] = useState<GraphLink[]>(data.links);

  const fitView = useCallback(() => {
    graphRef.current?.zoomToFit?.(400, 48);
  }, []);

  const reheatAndFit = useCallback(() => {
    graphRef.current?.d3ReheatSimulation?.();
    fitView();
  }, [fitView]);

  useEffect(() => {
    setNodes(seedNodes(data.nodes));
    setLinks(data.links);
    setSelected(null);
  }, [data]);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setDark(root.classList.contains('dark'));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onResize = () => reheatAndFit();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [reheatAndFit]);

  useEffect(() => {
    const id = window.setTimeout(() => reheatAndFit(), 80);
    return () => window.clearTimeout(id);
  }, [nodes, links, reheatAndFit]);

  const legend = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of data.nodes) map.set(n.category, n.color);
    return Array.from(map.entries());
  }, [data.nodes]);

  const canvasBg = dark ? '#171412' : '#FBFAF8';
  const linkStroke = dark ? 'rgba(168,162,158,0.35)' : 'rgba(28,25,23,0.18)';

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
        <div className="h-[480px] w-full bg-bg">
          <ForceGraph2D
            ref={graphRef}
            graphData={{ nodes, links }}
            nodeId="id"
            nodeLabel="title"
            nodeColor={(node) => {
              const n = node as FgNode;
              const base = n.color ?? '#166534';
              if (dark && base.toLowerCase() === '#166534') return '#4ADE80';
              return base;
            }}
            nodeRelSize={6}
            linkColor={() => linkStroke}
            linkWidth={(link) => Math.min(3, 1 + ((link as GraphLink).weight ?? 1) / 6)}
            backgroundColor={canvasBg}
            warmupTicks={40}
            cooldownTime={1200}
            onEngineStop={fitView}
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
