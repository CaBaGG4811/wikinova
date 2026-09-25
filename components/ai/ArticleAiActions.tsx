'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlignLeft, BadgeCheck, Languages, MessageCircle, RefreshCw, X } from 'lucide-react';
import type { ChatMessage, FactCheckItem } from '@/types';
import { ChatPanel, StreamBar, type UiChatMessage } from '@/components/ai/ChatPanel';
import { isAbortError, readSse } from '@/lib/ai/stream-client';
import { cn } from '@/lib/utils';

export interface ArticleAiActionsProps {
  articleId: string;
  summaryOpen?: boolean;
  onToggleSummary?: () => void;
}

interface TranslationState {
  lang: string;
  content: string;
}

interface FactCheckState {
  loading: boolean;
  error: string | null;
  items: FactCheckItem[];
}

const LANG_LABELS: Record<string, string> = {
  ru: 'Русский',
  en: 'Английский',
  de: 'Немецкий',
  fr: 'Французский',
  es: 'Испанский',
  zh: 'Китайский',
  it: 'Итальянский',
  pt: 'Португальский',
  ja: 'Японский',
};

const FALLBACK_LANGS = ['en', 'de', 'fr', 'es'];

const ASK_CHIPS = ['Объясни проще', 'Приведи пример', 'Что такое главное понятие?'];

const VERDICT_LABELS: Record<FactCheckItem['verdict'], string> = {
  confirmed: 'Подтверждено',
  not_found: 'Не найдено',
  conflict: 'Противоречие',
};

function verdictClass(verdict: FactCheckItem['verdict']): string {
  if (verdict === 'confirmed') return 'badge !border-ok/40 !text-ok';
  if (verdict === 'conflict') return 'badge !border-accent/45 !text-accent';
  return 'badge';
}

export function ArticleAiActions({
  articleId,
  summaryOpen,
  onToggleSummary,
}: ArticleAiActionsProps) {
  const [askOpen, setAskOpen] = useState(false);
  const [askMessages, setAskMessages] = useState<UiChatMessage[]>([]);
  const [askStreaming, setAskStreaming] = useState(false);
  const askAbortRef = useRef<AbortController | null>(null);

  const [langOpen, setLangOpen] = useState(false);
  const [panelLangOpen, setPanelLangOpen] = useState(false);
  const [langs, setLangs] = useState<string[]>(FALLBACK_LANGS);
  const [langsLoaded, setLangsLoaded] = useState(false);
  const [trans, setTrans] = useState<TranslationState | null>(null);
  const [transView, setTransView] = useState<'original' | 'translated'>('original');
  const [transLoading, setTransLoading] = useState(false);
  const [transError, setTransError] = useState<string | null>(null);
  const transAbortRef = useRef<AbortController | null>(null);

  const [factOpen, setFactOpen] = useState(false);
  const [fact, setFact] = useState<FactCheckState>({ loading: false, error: null, items: [] });

  const closeAsk = useCallback(() => {
    setAskOpen(false);
    askAbortRef.current?.abort();
  }, []);

  const loadLangs = useCallback(async () => {
    if (langsLoaded) return;
    try {
      const res = await fetch('/api/admin/ai/settings');
      if (res.ok) {
        const data = (await res.json()) as { languages?: unknown };
        if (Array.isArray(data.languages)) {
          const list = data.languages.filter((l): l is string => typeof l === 'string');
          if (list.length) setLangs(list);
        }
        setLangsLoaded(true);
        return;
      }
    } catch {
      // падаем на дефолтный список
    }
    setLangs(FALLBACK_LANGS);
    setLangsLoaded(true);
  }, [langsLoaded]);

  const askSend = useCallback(
    async (text: string) => {
      if (askStreaming) return;
      const question = text.trim();
      if (!question) return;
      const history: ChatMessage[] = [
        ...askMessages
          .filter((m) => !m.failed)
          .map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: question },
      ];
      setAskMessages([...askMessages, { role: 'user', content: question }, { role: 'assistant', content: '' }]);
      setAskStreaming(true);

      const controller = new AbortController();
      askAbortRef.current = controller;
      let acc = '';
      let failMessage: string | null = null;

      try {
        const res = await fetch('/api/ai/qa/article', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ articleId, messages: history.slice(-20) }),
          signal: controller.signal,
        });
        await readSse(res, {
          onDelta(delta) {
            acc += delta;
            setAskMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === 'assistant') next[next.length - 1] = { ...last, content: acc };
              return next;
            });
          },
          onDone() {
            // источники для ответа по статье не приходят
          },
          onError(message) {
            failMessage = message;
          },
        });
      } catch (err) {
        if (isAbortError(err)) {
          setAskStreaming(false);
          askAbortRef.current = null;
          setAskMessages((prev) => {
            const next = [...prev];
            if (acc) next[next.length - 1] = { role: 'assistant', content: acc };
            else next.pop();
            return next;
          });
          return;
        }
        failMessage = 'Не удалось связаться с сервером. Проверьте, что приложение запущено.';
      }

      setAskStreaming(false);
      askAbortRef.current = null;
      if (failMessage) {
        const message = failMessage;
        setAskMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: 'assistant', content: message, failed: true };
          return next;
        });
      } else {
        setAskMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === 'assistant') next[next.length - 1] = { ...last, content: acc };
          return next;
        });
      }
    },
    [articleId, askMessages, askStreaming],
  );

  const runTranslate = useCallback(
    async (lang: string) => {
      setLangOpen(false);
      setTransLoading(true);
      setTransError(null);
      const controller = new AbortController();
      transAbortRef.current = controller;
      let acc = '';
      let failMessage: string | null = null;

      try {
        const res = await fetch('/api/ai/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ articleId, lang }),
          signal: controller.signal,
        });
        await readSse(res, {
          onDelta(delta) {
            acc += delta;
          },
          onDone() {
            // язык берём из запроса
          },
          onError(message) {
            failMessage = message;
          },
        });
      } catch (err) {
        if (isAbortError(err)) {
          setTransLoading(false);
          return;
        }
        failMessage = 'Не удалось получить перевод. Проверьте настройки AI.';
      }

      setTransLoading(false);
      transAbortRef.current = null;
      if (failMessage) {
        setTransError(failMessage);
        return;
      }
      if (acc) {
        setTrans({ lang, content: acc });
        setTransView('translated');
      } else {
        setTransError('Модель вернула пустой перевод.');
      }
    },
    [articleId],
  );

  const runFactCheck = useCallback(async () => {
    setFactOpen(true);
    setFact({ loading: true, error: null, items: [] });
    try {
      const res = await fetch('/api/ai/fact-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId }),
      });
      const data = (await res.json().catch(() => null)) as { items?: FactCheckItem[]; error?: string } | null;
      if (!res.ok || !data) {
        setFact({
          loading: false,
          error: data?.error || `Ошибка ${res.status}. Проверьте настройки AI.`,
          items: [],
        });
        return;
      }
      setFact({ loading: false, error: null, items: Array.isArray(data.items) ? data.items : [] });
    } catch {
      setFact({
        loading: false,
        error: 'Локальная модель недоступна. Проверьте Base URL в настройках AI.',
        items: [],
      });
    }
  }, [articleId]);

  useEffect(() => {
    return () => {
      askAbortRef.current?.abort();
      transAbortRef.current?.abort();
    };
  }, []);

  const showTranslation = Boolean(trans) && transView === 'translated';

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onToggleSummary?.()}
          className={cn('btn-secondary !py-1.5 !px-2.5 text-sm', summaryOpen && 'border-violet-400 text-violet-600')}
          aria-expanded={summaryOpen ?? false}
        >
          <AlignLeft size={14} />
          <span className="hidden sm:inline">Кратко</span>
        </button>

        <button
          type="button"
          onClick={() => setAskOpen(true)}
          className={cn('btn-secondary !py-1.5 !px-2.5 text-sm', askOpen && 'border-violet-400 text-violet-600')}
          aria-expanded={askOpen}
        >
          <MessageCircle size={14} />
          <span className="hidden sm:inline">Спросить</span>
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              if (trans) {
                setTransView((v) => (v === 'translated' ? 'original' : 'translated'));
                return;
              }
              setLangOpen((v) => !v);
              void loadLangs();
            }}
            className={cn('btn-secondary !py-1.5 !px-2.5 text-sm', showTranslation && 'border-primary/60 text-primary')}
            aria-expanded={langOpen}
            disabled={transLoading}
          >
            <Languages size={14} />
            <span className="hidden sm:inline">
              {transLoading
                ? 'Переводим'
                : trans
                  ? showTranslation
                    ? 'Показать оригинал'
                    : 'Показать перевод'
                  : 'Перевести'}
            </span>
          </button>

          {langOpen ? (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setLangOpen(false)} aria-hidden="true" />
              <div className="absolute left-0 top-full mt-1 z-40 card shadow-float p-1.5 w-48 max-h-64 overflow-y-auto">
                {langs.map((code) => (
                  <button
                    key={code}
                    type="button"
                    className="w-full text-left px-2.5 py-1.5 text-sm rounded-md hover:bg-ink/5 transition-colors duration-150"
                    onClick={() => void runTranslate(code)}
                  >
                    {LANG_LABELS[code] ?? code}
                    <span className="ml-2 text-xs text-muted font-mono">{code}</span>
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => void runFactCheck()}
          className="btn-secondary !py-1.5 !px-2.5 text-sm"
        >
          <BadgeCheck size={14} />
          <span className="hidden sm:inline">Проверить</span>
        </button>
      </div>

      {transLoading || transError || showTranslation ? (
        <div className="card p-4 mt-3">
          <div className="flex items-start justify-between gap-3 mb-2">
            <p className="text-xs text-muted">Машинный перевод локальной модели</p>
            <button
              type="button"
              className="btn-ghost !px-2 !py-1 text-xs"
              onClick={() => {
                setTrans(null);
                setTransView('original');
                setTransError(null);
              }}
            >
              <X size={12} />
              Скрыть
            </button>
          </div>

          {transLoading ? (
            <div className="py-3">
              <StreamBar />
            </div>
          ) : transError ? (
            <p className="text-sm text-danger">{transError}</p>
          ) : trans ? (
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="badge font-mono">{trans.lang}</span>
                <button
                  type="button"
                  className="btn-ghost !py-1 !px-2 text-xs"
                  onClick={() =>
                    setTransView((v) => (v === 'translated' ? 'original' : 'translated'))
                  }
                >
                  {transView === 'translated' ? 'Показать оригинал' : 'Показать перевод'}
                </button>
                <div className="relative">
                  <button
                    type="button"
                    className="btn-ghost !py-1 !px-2 text-xs"
                    onClick={() => {
                      void loadLangs();
                      setPanelLangOpen((v) => !v);
                    }}
                    disabled={transLoading}
                  >
                    Другой язык
                  </button>
                  {panelLangOpen ? (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setPanelLangOpen(false)}
                        aria-hidden="true"
                      />
                      <div className="absolute left-0 top-full mt-1 z-40 card shadow-float p-1.5 w-48 max-h-56 overflow-y-auto">
                        {langs.map((code) => (
                          <button
                            key={code}
                            type="button"
                            className="w-full text-left px-2.5 py-1.5 text-sm rounded-md hover:bg-ink/5 transition-colors duration-150"
                            onClick={() => {
                              setPanelLangOpen(false);
                              void runTranslate(code);
                            }}
                          >
                            {LANG_LABELS[code] ?? code}
                            <span className="ml-2 text-xs text-muted font-mono">{code}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
              {showTranslation ? (
                <div className="prose-wiki" dangerouslySetInnerHTML={{ __html: trans.content }} />
              ) : (
                <p className="text-sm text-muted">
                  Оригинал статьи остаётся на странице. Нажмите, чтобы показать перевод.
                </p>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {askOpen ? (
        <>
          <div className="fixed inset-0 z-40 bg-ink/30" onClick={closeAsk} aria-hidden="true" />
          <aside
            className="fixed right-0 top-0 z-50 h-full w-full sm:w-[420px] border-l border-line bg-surface shadow-float flex flex-col animate-slide-in-right"
            role="dialog"
            aria-modal="true"
            aria-label="Вопрос по статье"
          >
            <header className="h-14 px-4 border-b border-line flex items-center justify-between shrink-0">
              <h2 className="font-display font-semibold text-base truncate">Вопрос по статье</h2>
              <button
                type="button"
                onClick={closeAsk}
                className="btn-ghost w-9 h-9 !p-0"
                aria-label="Закрыть"
              >
                <X size={16} />
              </button>
            </header>
            <div className="flex-1 min-h-0">
              <ChatPanel
                messages={askMessages}
                streaming={askStreaming}
                chips={ASK_CHIPS}
                placeholder="Вопрос по этой статье"
                onSubmit={(text) => {
                  void askSend(text);
                }}
                onStop={() => askAbortRef.current?.abort()}
                empty={
                  <p className="text-sm text-muted">
                    Отвечает по тексту статьи. Всё, что модель берёт вне статьи, пометит явно.
                  </p>
                }
              />
            </div>
          </aside>
        </>
      ) : null}

      {factOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setFactOpen(false)} aria-hidden="true" />
          <div
            className="relative card shadow-float w-full max-w-lg max-h-[80vh] overflow-y-auto p-5"
            role="dialog"
            aria-modal="true"
            aria-label="Проверка утверждений"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="font-display font-semibold text-base">Проверка утверждений</h3>
                <p className="text-xs text-muted mt-0.5">
                  Локальная модель сверяет факты со статьями вики
                </p>
              </div>
              <button
                type="button"
                className="btn-ghost w-9 h-9 !p-0 shrink-0"
                onClick={() => setFactOpen(false)}
                aria-label="Закрыть"
              >
                <X size={16} />
              </button>
            </div>

            {fact.loading ? (
              <div className="py-8 flex flex-col items-center gap-3 text-sm text-muted">
                <RefreshCw size={16} className="animate-spin" />
                Собираю отчёт
              </div>
            ) : fact.error ? (
              <div className="space-y-3">
                <p className="text-sm text-danger">{fact.error}</p>
                <button type="button" className="btn-secondary" onClick={() => void runFactCheck()}>
                  <RefreshCw size={14} />
                  Повторить
                </button>
              </div>
            ) : fact.items.length === 0 ? (
              <p className="text-sm text-muted">Модель не вернула утверждений для проверки.</p>
            ) : (
              <ul>
                {fact.items.map((item, i) => (
                  <li key={`${item.claim}-${i}`} className="py-3 border-t border-line first:border-0 first:pt-0">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-ink">{item.claim}</p>
                      <span className={verdictClass(item.verdict)}>{VERDICT_LABELS[item.verdict]}</span>
                    </div>
                    {item.sourceSlug ? (
                      <Link
                        href={`/article/${item.sourceSlug}`}
                        className="inline-block mt-1.5 text-sm text-primary underline underline-offset-2 hover:text-accent transition-colors duration-150"
                      >
                        {item.sourceTitle ?? item.sourceSlug}
                      </Link>
                    ) : item.verdict === 'not_found' ? (
                      <p className="text-xs text-muted mt-1.5">Подтверждающая статья не найдена</p>
                    ) : null}
                    {item.note ? <p className="text-xs text-muted mt-1">{item.note}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
