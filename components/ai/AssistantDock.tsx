'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Compass, X } from 'lucide-react';
import { ChatPanel, type UiChatMessage } from '@/components/ai/ChatPanel';
import { asSources, isAbortError, readSse } from '@/lib/ai/stream-client';

const STORAGE_KEY = 'wn-assistant-history';
const MAX_HISTORY = 40;

const EXAMPLE_QUESTIONS = [
  'Что в вики про квантовую механику?',
  'Объясни принцип неопределённости простыми словами',
  'Какие статьи есть про чёрные дыры?',
  'С чего начать изучение алгоритмов?',
];

function loadHistory(): UiChatMessage[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: UiChatMessage[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      if ((o.role === 'user' || o.role === 'assistant') && typeof o.content === 'string') {
        out.push({
          role: o.role,
          content: o.content,
          failed: o.failed === true,
          sources: asSources(o.sources),
        });
      }
    }
    return out.slice(-MAX_HISTORY);
  } catch {
    return [];
  }
}

export function AssistantDock() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<UiChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const historyLoaded = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setMessages(loadHistory());
    historyLoaded.current = true;
  }, []);

  useEffect(() => {
    if (!historyLoaded.current) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_HISTORY)));
    } catch {
      // переполнение localStorage не критично
    }
  }, [messages]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const send = useCallback(
    async (text: string) => {
      if (streaming) return;
      const question = text.trim();
      if (!question) return;

      const history = [...messages, { role: 'user' as const, content: question }];
      const withPlaceholder: UiChatMessage[] = [
        ...history,
        { role: 'assistant' as const, content: '' },
      ];
      setMessages(withPlaceholder);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;
      let acc = '';
      let failMessage: string | null = null;
      const holder: { payload: Record<string, unknown> | null } = { payload: null };

      try {
        const res = await fetch('/api/ai/qa/global', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: history.slice(-20) }),
          signal: controller.signal,
        });
        await readSse(res, {
          onDelta(delta) {
            acc += delta;
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === 'assistant') next[next.length - 1] = { ...last, content: acc };
              return next;
            });
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
          setStreaming(false);
          abortRef.current = null;
          setMessages((prev) => {
            const next = [...prev];
            if (acc) {
              next[next.length - 1] = { role: 'assistant', content: acc };
            } else {
              next.pop();
            }
            return next;
          });
          return;
        }
        failMessage = 'Не удалось связаться с сервером. Проверьте, что приложение запущено.';
      }

      setStreaming(false);
      abortRef.current = null;

      if (failMessage) {
        const message = failMessage;
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: 'assistant', content: message, failed: true };
          return next;
        });
        return;
      }

      const sources = asSources(holder.payload?.sources);
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === 'assistant') {
          next[next.length - 1] = { ...last, content: acc, sources };
        }
        return next;
      });
    },
    [messages, streaming],
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-xl border border-line bg-surface shadow-float flex items-center justify-center text-ink hover:border-ink/40 transition-colors duration-150"
        aria-label="AI-ассистент"
        title="AI-ассистент (Cmd/Ctrl+J)"
      >
        <Compass size={22} />
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-ink/30"
            onClick={close}
            aria-hidden="true"
          />
          <aside
            className="fixed right-0 top-0 z-50 h-full w-full sm:w-[420px] border-l border-line bg-surface shadow-float flex flex-col animate-slide-in-right"
            role="dialog"
            aria-modal="true"
            aria-label="Ассистент"
          >
            <header className="h-14 px-4 border-b border-line flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Compass size={16} className="text-primary shrink-0" />
                <h2 className="font-display font-semibold text-base truncate">Ассистент</h2>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="hidden sm:inline text-xs text-muted font-mono">Cmd/Ctrl+J</span>
                <button
                  type="button"
                  onClick={close}
                  className="btn-ghost w-9 h-9 !p-0"
                  aria-label="Закрыть"
                >
                  <X size={16} />
                </button>
              </div>
            </header>

            <div className="flex-1 min-h-0">
              <ChatPanel
                messages={messages}
                streaming={streaming}
                placeholder="Спросите по базе знаний"
                onSubmit={(text) => {
                  void send(text);
                }}
                onStop={stop}
                empty={
                  <div className="space-y-4">
                    <p className="text-sm text-muted">
                      Отвечаю по материалам вики. Задайте вопрос или выберите пример ниже.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {EXAMPLE_QUESTIONS.map((q) => (
                        <button
                          key={q}
                          type="button"
                          className="btn-secondary !py-1.5 !px-3 text-xs text-left"
                          onClick={() => void send(q)}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                }
              />
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
}
