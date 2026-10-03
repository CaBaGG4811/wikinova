'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
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

  useEffect(() => {
    function onOpen(e: Event) {
      setOpen(true);
      const detail = (e as CustomEvent).detail as { question?: unknown } | null;
      const question = typeof detail?.question === 'string' ? detail.question.trim() : '';
      if (question) void send(question);
    }
    window.addEventListener('galileo:assistant', onOpen);
    return () => window.removeEventListener('galileo:assistant', onOpen);
  }, [send]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-2xl bg-gradient-to-br from-accent to-ai shadow-[0_10px_30px_-8px_rgb(84_92_161/0.6)] flex items-center justify-center text-white hover:from-[#4a5193] hover:to-[#9c78b2] transition-colors duration-150"
        aria-label="Ассистент ГАЛИЛЕО"
        title="Ассистент ГАЛИЛЕО"
      >
        <Sparkles size={22} />
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-ink/30"
            onClick={close}
            aria-hidden="true"
          />
          <aside
            className="fixed right-0 top-0 z-50 h-full w-full sm:w-[420px] border-l border-line bg-white shadow-float flex flex-col animate-slide-in-right"
            role="dialog"
            aria-modal="true"
            aria-label="Ассистент"
          >
            <header className="h-16 px-4 border-b border-line flex items-center justify-between gap-3 shrink-0 bg-white">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-ai text-white shadow-[0_6px_16px_-8px_rgb(84_92_161/0.7)]">
                  <Sparkles size={17} />
                </div>
                <div className="min-w-0 leading-tight">
                  <h2 className="font-display font-bold text-base truncate text-ink">
                    Ассистент ГАЛИЛЕО
                  </h2>
                  <p className="text-xs text-muted truncate">Отвечает по статьям энциклопедии</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
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
                  <div className="flex flex-1 flex-col items-center justify-center px-2 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-ai text-white shadow-[0_10px_26px_-10px_rgb(84_92_161/0.7)]">
                      <Sparkles size={24} />
                    </div>
                    <p className="mt-4 font-display text-lg font-bold text-ink">
                      Чем я могу помочь?
                    </p>
                    <p className="mt-1.5 max-w-[300px] text-sm text-muted">
                      Отвечаю по материалам энциклопедии ГАЛИЛЕО. Задайте вопрос или выберите
                      пример ниже.
                    </p>
                    <div className="mt-5 flex w-full flex-col gap-2">
                      {EXAMPLE_QUESTIONS.map((q) => (
                        <button
                          key={q}
                          type="button"
                          className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-left text-sm text-ink transition hover:border-accent/50 hover:bg-accent/10 hover:text-accent"
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
