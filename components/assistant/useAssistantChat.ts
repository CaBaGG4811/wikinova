'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { UiChatMessage } from '@/components/ai/ChatPanel';
import { asSources, isAbortError, readSse } from '@/lib/ai/stream-client';

const STORAGE_KEY = 'galileo-chat-history';
const LEGACY_STORAGE_KEY = 'wn-assistant-history';
const MAX_HISTORY = 40;

function loadHistory(): UiChatMessage[] {
  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
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

export function useAssistantChat() {
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

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setStreaming(false);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // noop
    }
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

  return { messages, streaming, send, stop, reset };
}
