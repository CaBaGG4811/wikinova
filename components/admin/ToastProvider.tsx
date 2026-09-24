'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

type ToastKind = 'ok' | 'err';
interface ToastItem {
  id: number;
  text: string;
  kind: ToastKind;
}

type ToastFn = (text: string, kind?: ToastKind) => void;

const ToastContext = createContext<ToastFn>(() => undefined);

export function useToast(): ToastFn {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const push = useCallback<ToastFn>((text, kind = 'ok') => {
    idRef.current += 1;
    const id = idRef.current;
    setItems((prev) => [...prev, { id, text, kind }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 items-end pointer-events-none">
        {items.map((t) => (
          <div
            key={t.id}
            className={
              t.kind === 'err'
                ? 'rounded-md border border-danger/50 bg-surface px-3 py-2 text-sm text-ink max-w-xs'
                : 'rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink max-w-xs'
            }
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
