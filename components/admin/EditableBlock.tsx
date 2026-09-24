'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check, Loader2, Pencil, X } from 'lucide-react';
import { useIsEditor } from '@/lib/hooks/useIsEditor';
import { useToast } from '@/components/admin/ToastProvider';

type Tag = 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'div';

interface EditableBlockProps {
  blockKey: string;
  defaultValue?: string;
  as?: Tag;
  className?: string;
  multiline?: boolean;
}

export function EditableBlock({
  blockKey,
  defaultValue = '',
  as: Tag = 'p',
  className,
  multiline = false,
}: EditableBlockProps) {
  const { isEditor, isLoading } = useIsEditor();
  const toast = useToast();
  const inputId = useId();
  const [value, setValue] = useState(defaultValue);
  const [draft, setDraft] = useState(defaultValue);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(true);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setFetching(true);
    fetch(`/api/blocks?keys=${encodeURIComponent(blockKey)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data || typeof data[blockKey] !== 'string') return;
        loadedRef.current = true;
        if (!editing) {
          setValue(data[blockKey]);
          setDraft(data[blockKey]);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setFetching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [blockKey]);

  useEffect(() => {
    if (!editing) return;
    const node = multiline ? textareaRef.current : inputRef.current;
    if (!node) return;
    node.focus();
    node.select();
  }, [editing, multiline]);

  if (isLoading) {
    return <Tag className={className}>{defaultValue}</Tag>;
  }

  if (!isEditor) {
    return <Tag className={className}>{value || defaultValue}</Tag>;
  }

  const startEdit = () => {
    setDraft(value || defaultValue);
    setEditing(true);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  const save = async () => {
    if (saving) return;
    const next = draft;
    setSaving(true);
    try {
      const res = await fetch('/api/blocks', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: blockKey, value: next }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        const msg =
          (data && typeof data.error === 'string' && data.error) ||
          'Не удалось сохранить';
        toast(msg, 'err');
        return;
      }
      setValue(next);
      setEditing(false);
      toast('Сохранено');
    } catch {
      toast('Ошибка сети. Текст не потерян.', 'err');
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void save();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  };

  if (editing) {
    return (
      <span className={`inline-flex w-full items-start gap-2 ${className ?? ''}`}>
        {multiline ? (
          <textarea
            ref={textareaRef}
            id={inputId}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            rows={Math.min(12, Math.max(3, draft.split('\n').length + 1))}
            className="min-w-0 flex-1 resize-y border-b-2 border-[#166534] bg-transparent px-0 py-1 font-[inherit] text-[length:inherit] leading-[inherit] text-inherit outline-none"
            aria-label="Редактировать текст"
          />
        ) : (
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            className={`min-w-0 flex-1 border-b-2 border-[#166534] bg-transparent px-0 py-1 outline-none ${className ?? ''}`}
            aria-label="Редактировать текст"
          />
        )}
        <span className="flex shrink-0 items-center gap-1 pt-1">
          {saving || fetching ? (
            <Loader2 size={14} className="animate-spin text-[#57534E]" aria-hidden />
          ) : null}
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="rounded-md p-1 text-muted transition-colors duration-150 hover:text-primary disabled:opacity-50"
            title="Сохранить"
            aria-label="Сохранить"
          >
            <Check size={14} />
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={saving}
            className="rounded-md p-1 text-muted transition-colors duration-150 hover:text-ink disabled:opacity-50"
            title="Отменить"
            aria-label="Отменить"
          >
            <X size={14} />
          </button>
        </span>
      </span>
    );
  }

  const Wrapper = Tag === 'span' ? 'span' : 'div';

  return (
    <Wrapper className="group/edit inline-flex max-w-full items-baseline gap-1.5">
      <Tag className={className}>{value || defaultValue}</Tag>
      <button
        type="button"
        onClick={startEdit}
        title="Редактировать"
        aria-label="Редактировать"
        className="shrink-0 self-center opacity-0 transition-opacity duration-150 group-hover/edit:opacity-100 focus-visible:opacity-100"
        style={{ color: 'var(--text-secondary, #57534E)' }}
      >
        {fetching ? (
          <Loader2 size={14} className="animate-spin" aria-hidden />
        ) : (
          <Pencil size={14} aria-hidden />
        )}
      </button>
    </Wrapper>
  );
}
