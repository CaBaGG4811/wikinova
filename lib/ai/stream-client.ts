import type { RagSource } from '@/types';

export interface SseHandlers {
  onDelta(delta: string): void;
  onDone(payload: Record<string, unknown>): void;
  onError(message: string): void;
}

export function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException) return err.name === 'AbortError';
  return err instanceof Error && err.name === 'AbortError';
}

export function asSources(value: unknown): RagSource[] {
  if (!Array.isArray(value)) return [];
  const out: RagSource[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    if (typeof o.id === 'string' && typeof o.slug === 'string' && typeof o.title === 'string') {
      out.push({
        id: o.id,
        slug: o.slug,
        title: o.title,
        excerpt: typeof o.excerpt === 'string' ? o.excerpt : '',
      });
    }
  }
  return out;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

export async function readSse(res: Response, handlers: SseHandlers): Promise<void> {
  if (!res.ok) {
    let message = `Запрос завершился с ошибкой ${res.status}.`;
    try {
      const data = (await res.json()) as { error?: unknown };
      if (typeof data.error === 'string' && data.error) message = data.error;
    } catch {
      // тело не JSON
    }
    handlers.onError(message);
    return;
  }

  const body = res.body;
  if (!body) {
    handlers.onError('Сервер вернул пустой поток.');
    return;
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finished = false;

  const handleBlock = (block: string): boolean => {
    for (const line of block.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      let obj: Record<string, unknown>;
      try {
        obj = JSON.parse(line.slice(6)) as Record<string, unknown>;
      } catch {
        continue;
      }
      if (typeof obj.error === 'string' && obj.error) {
        handlers.onError(obj.error);
        return true;
      }
      if (typeof obj.delta === 'string') handlers.onDelta(obj.delta);
      if (obj.done === true) {
        handlers.onDone(obj);
        return true;
      }
    }
    return false;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx = buffer.indexOf('\n\n');
    while (idx >= 0) {
      const block = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      if (handleBlock(block)) {
        finished = true;
        break;
      }
      idx = buffer.indexOf('\n\n');
    }
    if (finished) break;
  }

  if (!finished) {
    handlers.onError('Поток прерван: модель не ответила полностью.');
  }
}
