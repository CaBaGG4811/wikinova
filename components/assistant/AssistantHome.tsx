'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUp, Mic, Plus } from 'lucide-react';
import { ChatPanel } from '@/components/ai/ChatPanel';
import { useAssistantChat } from '@/components/assistant/useAssistantChat';

const POPULAR_QUESTIONS = [
  'Как работает квантовый компьютер?',
  'История Рима',
  'Биография Пушкина',
  'Что такое нейросеть?',
  'Как устроен фотосинтез?',
];

interface AssistantHomeProps {
  initialQuestion?: string;
}

export function AssistantHome({ initialQuestion }: AssistantHomeProps) {
  const router = useRouter();
  const { messages, streaming, send, stop, reset } = useAssistantChat();
  const [q, setQ] = useState('');
  const [searchMode, setSearchMode] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!initialQuestion || startedRef.current) return;
    startedRef.current = true;
    void send(initialQuestion);
    return undefined;
  }, [initialQuestion, send]);

  const chatActive = messages.length > 0;

  function submit(text: string) {
    const value = text.trim();
    if (!value) return;
    if (searchMode) {
      router.push(`/search?q=${encodeURIComponent(value)}`);
      return;
    }
    void send(value);
  }

  if (chatActive) {
    return (
      <div className="mx-auto flex h-screen w-full max-w-3xl flex-col px-4 pb-4 pt-16">
        <div className="flex shrink-0 items-center justify-between pb-3">
          <span className="text-sm font-semibold text-muted">Ассистент ГАЛИЛЕО</span>
          <button
            type="button"
            onClick={reset}
            className="btn-secondary !py-1.5 !px-3 text-xs"
          >
            <Plus size={13} />
            Новый вопрос
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <ChatPanel
            messages={messages}
            streaming={streaming}
            placeholder="Задайте уточняющий вопрос"
            onSubmit={(text) => {
              void send(text);
            }}
            onStop={stop}
            empty={null}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-y-auto px-6">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center py-10">
        <h1 className="text-center font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
          Что вы хотите узнать?
        </h1>
        <p className="mt-4 text-center text-base text-muted">
          Задайте вопрос Ассистенту или найдите ответ в статьях ГАЛИЛЕО.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(q);
            setQ('');
          }}
          role="search"
          className="mt-8 w-full"
        >
          <div className="mb-3 flex items-center gap-2.5">
            <button
              type="button"
              role="switch"
              aria-checked={searchMode}
              aria-label="Поиск по статьям"
              onClick={() => setSearchMode((v) => !v)}
              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${
                searchMode ? 'bg-primary' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  searchMode ? 'translate-x-[18px]' : 'translate-x-0.5'
                }`}
              />
            </button>
            <span className="text-sm font-medium text-muted">Поиск по статьям</span>
          </div>

          <div className="flex flex-col rounded-2xl border border-accent/50 bg-white px-4 pb-3 pt-4 transition-all duration-200 focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/10">
            <textarea
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  const form = e.currentTarget.form;
                  if (form) form.requestSubmit();
                }
              }}
              rows={2}
              placeholder="Напишите вопрос или используйте голосовой ввод"
              aria-label="Задайте вопрос"
              autoComplete="off"
              className="min-h-[64px] w-full resize-none bg-transparent text-lg leading-relaxed text-ink outline-none placeholder:text-muted/70"
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                aria-label="Голосовой ввод"
                title="Голосовой ввод скоро заработает"
                className="rounded-lg border border-line p-2 text-muted transition-colors hover:border-accent/50 hover:text-accent"
              >
                <Mic size={18} />
              </button>
              <button
                type="submit"
                aria-label="Спросить"
                className="rounded-lg bg-primary p-2 text-white shadow-sm transition hover:bg-[#41719f]"
              >
                <ArrowUp size={18} />
              </button>
            </div>
          </div>
        </form>

        <div className="mt-7">
          <div className="mb-3 text-sm font-semibold text-muted">Самые популярные вопросы</div>
          <div className="flex flex-wrap gap-2">
            {POPULAR_QUESTIONS.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => submit(question)}
                className="rounded-xl bg-surface px-3.5 py-2 text-sm text-ink transition hover:bg-accent/10 hover:text-accent"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
