import { humanizeAiError } from '@/lib/ai/client';

export const SSE_HEADERS: Record<string, string> = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
};

export interface SseCtl {
  delta(text: string): void;
  done(payload?: Record<string, unknown>): void;
  fail(message: string): void;
}

function tryClose(controller: ReadableStreamDefaultController<Uint8Array>): void {
  try {
    controller.close();
  } catch {
    // поток уже закрыт
  }
}

export function sseStream(
  req: Request,
  run: (ctl: SseCtl, signal: AbortSignal) => Promise<void>,
): Response {
  const encoder = new TextEncoder();
  const abort = new AbortController();
  const onAbort = () => abort.abort();
  if (req.signal.aborted) abort.abort();
  else req.signal.addEventListener('abort', onAbort, { once: true });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (obj: unknown): void => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          closed = true;
        }
      };
      const finish = (): void => {
        if (closed) return;
        closed = true;
        tryClose(controller);
      };
      const ctl: SseCtl = {
        delta: (text) => send({ delta: text }),
        done: (payload) => {
          send({ done: true, ...(payload ?? {}) });
          finish();
        },
        fail: (message) => {
          send({ error: message });
          finish();
        },
      };
      try {
        await run(ctl, abort.signal);
        if (!closed) ctl.done();
      } catch (err) {
        ctl.fail(humanizeAiError(err));
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
