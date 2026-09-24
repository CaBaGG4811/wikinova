'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { BookOpen, Check, Copy, Square } from 'lucide-react';
import type { RagSource } from '@/types';
import { Markdown } from '@/components/ai/Markdown';
import { cn } from '@/lib/utils';

export interface UiChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: RagSource[];
  failed?: boolean;
}

const STREAM_CSS = `
.ai-stream{display:inline-flex;width:72px;height:2px;border-radius:1px;background:rgb(var(--c-line));position:relative;overflow:hidden;vertical-align:middle}
.ai-stream::after{content:'';position:absolute;top:0;bottom:0;left:0;width:36%;background:rgb(var(--c-primary));animation:ai-sweep 1.1s linear infinite}
@keyframes ai-sweep{0%{transform:translateX(-110%)}100%{transform:translateX(320%)}}
@media (prefers-reduced-motion: reduce){.ai-stream::after{animation:none;width:100%;opacity:.55}}
`;

export function StreamBar() {
  return <span className="ai-stream" aria-hidden="true" />;
}

function CopyAnswerButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-ghost !px-2 !py-1 text-xs"
      aria-label="Копировать ответ"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Скопировано' : 'Копировать'}
    </button>
  );
}

function SourceList({ sources }: { sources: RagSource[] }) {
  if (!sources.length) return null;
  return (
    <ul className="mt-3 grid gap-2">
      {sources.map((s) => (
        <li key={s.id}>
          <Link
            href={`/article/${s.slug}`}
            className="card block px-3 py-2.5 hover:border-ink/35 transition-colors duration-150"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-ink">
              <BookOpen size={13} className="text-primary shrink-0" />
              {s.title}
            </span>
            {s.excerpt ? (
              <span className="block text-xs text-muted mt-1 line-clamp-2">{s.excerpt}</span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export interface ChatPanelProps {
  messages: UiChatMessage[];
  streaming: boolean;
  chips?: string[];
  placeholder?: string;
  empty?: ReactNode;
  onSubmit(text: string): void;
  onStop(): void;
}

export function ChatPanel({
  messages,
  streaming,
  chips,
  placeholder = 'Спросите по базе знаний',
  empty,
  onSubmit,
  onStop,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastStreamingIndex = streaming ? messages.length - 1 : -1;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  const trimmed = input.trim();

  return (
    <div className="flex flex-col h-full min-h-0">
      <style>{STREAM_CSS}</style>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="py-2">{empty}</div>
        ) : (
          <div className="space-y-4">
            {messages.map((m, i) => (
              <div
                key={`${i}-${m.role}`}
                className={cn('pt-4 first:pt-0 border-t border-line first:border-0')}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-medium text-muted font-display">
                    {m.role === 'user' ? 'Вы' : 'Ассистент'}
                  </span>
                  {m.role === 'assistant' && m.content && !m.failed && i !== lastStreamingIndex ? (
                    <CopyAnswerButton text={m.content} />
                  ) : null}
                </div>

                {m.role === 'user' ? (
                  <p className="text-sm text-ink whitespace-pre-wrap break-words">{m.content}</p>
                ) : m.failed ? (
                  <p className="text-sm text-danger whitespace-pre-wrap break-words">{m.content}</p>
                ) : m.content ? (
                  <div>
                    <Markdown>{m.content}</Markdown>
                    {i === lastStreamingIndex ? (
                      <div className="mt-2">
                        <StreamBar />
                      </div>
                    ) : null}
                  </div>
                ) : i === lastStreamingIndex ? (
                  <StreamBar />
                ) : null}

                {m.sources?.length ? <SourceList sources={m.sources} /> : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-line px-4 py-3">
        {!streaming && chips?.length ? (
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {chips.map((chip) => (
              <button
                key={chip}
                type="button"
                className="btn-secondary !py-1 !px-2.5 text-xs"
                onClick={() => onSubmit(chip)}
              >
                {chip}
              </button>
            ))}
          </div>
        ) : null}

        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!trimmed || streaming) return;
            onSubmit(trimmed);
            setInput('');
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!trimmed || streaming) return;
                onSubmit(trimmed);
                setInput('');
              }
            }}
            rows={2}
            placeholder={placeholder}
            className="input resize-none"
            aria-label="Сообщение"
          />
          {streaming ? (
            <button type="button" onClick={onStop} className="btn-secondary shrink-0">
              <Square size={14} />
              Стоп
            </button>
          ) : (
            <button type="submit" disabled={!trimmed} className="btn-primary shrink-0">
              Отправить
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
