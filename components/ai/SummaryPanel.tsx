'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Markdown } from '@/components/ai/Markdown';
import { StreamBar } from '@/components/ai/ChatPanel';
import { asStringArray, isAbortError, readSse } from '@/lib/ai/stream-client';
import { cn } from '@/lib/utils';

export interface SummaryPanelProps {
  articleId: string;
  open: boolean;
  onClose: () => void;
}

export function SummaryPanel({ articleId, open, onClose }: SummaryPanelProps) {
  const [summary, setSummary] = useState('');
  const [keyFacts, setKeyFacts] = useState<string[]>([]);
  const [model, setModel] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedRef = useRef(false);

  const load = useCallback(
    async (refresh: boolean) => {
      if (loading) return;
      setLoading(true);
      setError(null);
      const controller = new AbortController();
      abortRef.current = controller;
      let acc = '';
      let failMessage: string | null = null;
      const holder: { payload: Record<string, unknown> | null } = { payload: null };

      try {
        const res = await fetch('/api/ai/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ articleId, refresh }),
          signal: controller.signal,
        });
        await readSse(res, {
          onDelta(delta) {
            acc += delta;
          },
          onDone(payload) {
            holder.payload = payload;
          },
          onError(message) {
            failMessage = message;
          },
        });
      } catch (err) {
        if (isAbortError(err)) {
          setLoading(false);
          return;
        }
        failMessage = 'Локальная модель недоступна. Проверьте Base URL в настройках AI.';
      }

      setLoading(false);
      abortRef.current = null;

      if (failMessage) {
        setError(failMessage);
        return;
      }

      setSummary(acc);
      setKeyFacts(asStringArray(holder.payload?.keyFacts));
      setLoaded(true);
      startedRef.current = true;

      if (model === null) {
        try {
          const res = await fetch('/api/admin/ai/settings');
          if (res.ok) {
            const data = (await res.json()) as { model?: unknown };
            if (typeof data.model === 'string' && data.model) setModel(data.model);
          }
        } catch {
          // подпись останется общей
        }
      }
    },
    [articleId, loading, model],
  );

  useEffect(() => {
    if (open && !loaded && !loading && !startedRef.current) {
      startedRef.current = true;
      void load(false);
    }
  }, [open, loaded, loading, load]);

  useEffect(() => () => abortRef.current?.abort(), []);

  return (
    <div
      className={cn(
        'grid transition-[grid-template-rows] duration-300',
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
      )}
    >
      <div className="overflow-hidden">
        {open && (loaded || loading || error) ? (
          <div className="card p-4 my-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-medium text-muted font-display">
                  Краткий пересказ
                </h3>
                <button
                  type="button"
                  className="btn-ghost !px-2 !py-1 text-xs"
                  onClick={() => void load(true)}
                  disabled={loading}
                  aria-label="Обновить пересказ"
                >
                  <RefreshCw size={12} className={loading ? 'animate-spin' : undefined} />
                  Обновить
                </button>
              </div>
              <button
                type="button"
                className="btn-ghost !px-2 !py-1 text-xs"
                onClick={onClose}
                aria-label="Свернуть"
              >
                <X size={12} />
              </button>
            </div>

            {loading && !loaded ? (
              <div className="py-3">
                <StreamBar />
              </div>
            ) : error ? (
              <div className="space-y-2">
                <p className="text-sm text-danger">{error}</p>
                <button type="button" className="btn-secondary !py-1.5 text-xs" onClick={() => void load(true)}>
                  <RefreshCw size={12} />
                  Повторить
                </button>
              </div>
            ) : (
              <div>
                <Markdown>{summary}</Markdown>
                {keyFacts.length ? (
                  <ul className="mt-3 space-y-1.5">
                    {keyFacts.map((fact, i) => (
                      <li key={`${i}-${fact.slice(0, 24)}`} className="flex gap-2 text-sm text-ink">
                        <span className="text-primary shrink-0">•</span>
                        <span>{fact}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="text-xs text-muted mt-3">
                  {model
                    ? `Сгенерировано локальной моделью ${model}`
                    : 'Сгенерировано локальной моделью'}
                </p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
