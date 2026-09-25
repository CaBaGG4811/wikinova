'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import UnderlineExt from '@tiptap/extension-underline';
import LinkExt from '@tiptap/extension-link';
import ImageExt from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Image as ImageIcon,
  Video,
  Images,
  Minus,
  Table as TableIcon,
  Heading1,
  Heading2,
  Heading3,
  PenLine,
  Minimize2,
  Maximize2,
  Scale,
  Feather,
  AlignJustify,
  BookOpen,
  ChevronDown,
  History,
  RotateCcw,
  Eye,
  X,
  Plus,
  Upload,
  Loader2,
} from 'lucide-react';
import { cn, slugify, readingTime, formatDate } from '@/lib/utils';
import { Modal } from '@/components/admin/Modal';
import { useToast } from '@/components/admin/ToastProvider';
import { IframeEmbed, HtmlVideo } from '@/components/admin/tiptap-nodes';

const AI_DOWN = 'Локальная модель недоступна. Проверьте Base URL в настройках AI.';

type ArticleStatus = 'draft' | 'published' | 'archived';
type ImproveMode = 'improve' | 'shorten' | 'expand' | 'neutral' | 'simple' | 'consistent';

interface InitialArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string | null;
  status: ArticleStatus;
  featured: boolean;
  categoryId: string | null;
  tagIds: string[];
  authorId: string;
  seoTitle: string;
  seoDescription: string;
  ogImage: string;
}

interface TagRow {
  id: string;
  name: string;
  slug: string;
}

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  color?: string;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface VersionRow {
  id: string;
  title: string;
  createdAt: string;
  createdBy?: { id: string; name: string } | null;
}

interface AiMetadataResult {
  title?: string;
  description?: string;
  slug?: string;
  excerpt?: string;
  tags?: string[];
  category?: string;
}

interface DiffState {
  before: string;
  after: string;
  range: { from: number; to: number };
}

const improveModes: { mode: ImproveMode; label: string; Icon: typeof PenLine }[] = [
  { mode: 'improve', label: 'Улучшить', Icon: PenLine },
  { mode: 'shorten', label: 'Сократить', Icon: Minimize2 },
  { mode: 'expand', label: 'Расширить', Icon: Maximize2 },
  { mode: 'neutral', label: 'Переписать нейтрально', Icon: Scale },
  { mode: 'simple', label: 'Упростить', Icon: Feather },
  { mode: 'consistent', label: 'Единый стиль', Icon: AlignJustify },
];

function pickUrl(data: Record<string, unknown> | null): string | null {
  if (!data) return null;
  const direct = data.url;
  if (typeof direct === 'string' && direct) return direct;
  for (const key of ['file', 'media', 'data', 'result']) {
    const nested = data[key];
    if (nested && typeof nested === 'object') {
      const u = (nested as Record<string, unknown>).url;
      if (typeof u === 'string' && u) return u;
    }
  }
  return null;
}

function embedUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.hostname === 'youtu.be' || u.hostname.endsWith('.youtu.be')) {
      const id = u.pathname.slice(1);
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${v}`;
      const parts = u.pathname.split('/').filter(Boolean);
      const last = parts[parts.length - 1];
      if (last && (u.pathname.startsWith('/embed/') || u.pathname.startsWith('/shorts/'))) {
        return `https://www.youtube.com/embed/${last}`;
      }
      return null;
    }
    if (u.hostname.includes('vimeo.com')) {
      const parts = u.pathname.split('/').filter(Boolean);
      const id = parts[parts.length - 1];
      return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
    }
    return null;
  } catch {
    return null;
  }
}

async function uploadFile(file: File, folder: 'images' | 'videos' | 'docs'): Promise<string> {
  const limit =
    folder === 'images' ? 10 * 1024 * 1024 : folder === 'videos' ? 100 * 1024 * 1024 : 20 * 1024 * 1024;
  if (file.size > limit) {
    const label =
      folder === 'images'
        ? 'Изображение больше 10 МБ'
        : folder === 'videos'
          ? 'Видео больше 100 МБ'
          : 'Документ больше 20 МБ';
    throw new Error(label);
  }
  const fd = new FormData();
  fd.append('file', file);
  fd.append('folder', folder);
  const res = await fetch('/api/upload', { method: 'POST', body: fd });
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    const msg = data && typeof data.error === 'string' ? data.error : 'Не удалось загрузить файл';
    throw new Error(msg);
  }
  const url = pickUrl(data);
  if (!url) throw new Error('Не удалось загрузить файл');
  return url;
}

interface SaveOpts {
  target?: ArticleStatus;
  silent?: boolean;
}

function TBtn(props: {
  active?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={props.title}
      aria-label={props.title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={props.onClick}
      className={cn(
        'rounded-md p-1.5 text-muted hover:text-ink hover:bg-ink/5 transition-colors duration-150',
        props.active && 'bg-ink/10 text-ink',
      )}
    >
      {props.children}
    </button>
  );
}

export default function ArticleEditor({
  initial,
  isAdmin,
}: {
  initial: InitialArticle | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const toast = useToast();

  const [articleId, setArticleId] = useState<string | null>(initial?.id ?? null);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? '');
  const [coverImage, setCoverImage] = useState<string | null>(initial?.coverImage ?? null);
  const [status, setStatus] = useState<ArticleStatus>(initial?.status ?? 'draft');
  const [featured] = useState<boolean>(initial?.featured ?? false);
  const [categoryId, setCategoryId] = useState<string | null>(initial?.categoryId ?? null);
  const [tagIds, setTagIds] = useState<string[]>(initial?.tagIds ?? []);
  const [authorId, setAuthorId] = useState<string>(initial?.authorId ?? '');
  const [seoTitle, setSeoTitle] = useState(initial?.seoTitle ?? '');
  const [seoDescription, setSeoDescription] = useState(initial?.seoDescription ?? '');
  const [ogImage, setOgImage] = useState(initial?.ogImage ?? '');

  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [tags, setTags] = useState<TagRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [versionsOpen, setVersionsOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const articleIdRef = useRef<string | null>(articleId);
  articleIdRef.current = articleId;

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoTab, setVideoTab] = useState<'url' | 'file'>('url');
  const [videoBusy, setVideoBusy] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [imageBusy, setImageBusy] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const [draftConfirmOpen, setDraftConfirmOpen] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftTopic, setDraftTopic] = useState('');
  const [draftPoints, setDraftPoints] = useState('');
  const [draftLevel, setDraftLevel] = useState('стандарт');
  const [draftStyle, setDraftStyle] = useState('энциклопедический');

  const [menu, setMenu] = useState<{ x: number; y: number; from: number; to: number } | null>(null);
  const [improveBusy, setImproveBusy] = useState<ImproveMode | null>(null);
  const [diff, setDiff] = useState<DiffState | null>(null);

  const [metaBusy, setMetaBusy] = useState(false);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [suggestedCategory, setSuggestedCategory] = useState<string | null>(null);
  const [qualityBusy, setQualityBusy] = useState(false);
  const [quality, setQuality] = useState<{ score: number; issues: string[]; suggestions: string[] } | null>(null);
  const [autoTagsBusy, setAutoTagsBusy] = useState(false);

  const [newTag, setNewTag] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const initialRef = useRef(initial);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    setDirty(true);
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      UnderlineExt,
      LinkExt.configure({ openOnClick: false, autolink: true }),
      ImageExt,
      Placeholder.configure({ placeholder: 'Начните писать статью...' }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      IframeEmbed,
      HtmlVideo,
    ],
    content: initialRef.current?.content ?? '',
    onUpdate: () => markDirty(),
  });

  useEffect(() => {
    if (!editor) return;
    const onSel = () => {
      const { state, view } = editor;
      const { from, to } = state.selection;
      const text = state.doc.textBetween(from, to, ' ').trim();
      const words = text ? text.split(/\s+/).length : 0;
      if (words > 2) {
        const sel = window.getSelection();
        let x = 0;
        let y = 0;
        if (sel && sel.rangeCount > 0) {
          const rect = sel.getRangeAt(0).getBoundingClientRect();
          x = rect.left + rect.width / 2;
          y = rect.bottom;
        }
        if (!x && !y) {
          const coords = view.coordsAtPos(from);
          x = coords.left;
          y = coords.bottom;
        }
        setMenu({ x, y, from, to });
      } else {
        setMenu(null);
      }
    };
    const onBlur = () => setMenu(null);
    editor.on('selectionUpdate', onSel);
    editor.on('blur', onBlur);
    return () => {
      editor.off('selectionUpdate', onSel);
      editor.off('blur', onBlur);
    };
  }, [editor]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [menu]);

  useEffect(() => {
    fetch('/api/admin/categories')
      .then((r) => (r.ok ? r.json() : { categories: [] }))
      .then((d: { categories?: CategoryRow[] }) => setCategories(d.categories ?? []))
      .catch(() => toast('Не удалось загрузить категории', 'err'));
    fetch('/api/admin/tags')
      .then((r) => (r.ok ? r.json() : { tags: [] }))
      .then((d: { tags?: (TagRow & { _count?: { articles: number } })[] }) =>
        setTags((d.tags ?? []).map((t) => ({ id: t.id, name: t.name, slug: t.slug }))),
      )
      .catch(() => toast('Не удалось загрузить теги', 'err'));
    if (isAdmin) {
      fetch('/api/admin/users')
        .then((r) => (r.ok ? r.json() : { users: [] }))
        .then((d: { users?: UserRow[] }) => setUsers(d.users ?? []))
        .catch(() => undefined);
    }
  }, [isAdmin, toast]);

  const fetchVersions = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/admin/articles/${id}/versions`);
        if (!res.ok) return;
        const data = (await res.json()) as { versions: VersionRow[] };
        setVersions(data.versions);
      } catch {
        return;
      }
    },
    [],
  );

  useEffect(() => {
    if (articleId) fetchVersions(articleId);
  }, [articleId, fetchVersions]);

  const buildPayload = useCallback(
    () => ({
      title: title.trim(),
      slug: slug.trim() || slugify(title),
      excerpt,
      content: editor ? editor.getHTML() : '',
      coverImage: coverImage || null,
      status,
      featured,
      categoryId: categoryId || null,
      tagIds,
      seoTitle,
      seoDescription,
      ogImage: ogImage || null,
      readingTime: readingTime(editor ? editor.getHTML() : ''),
    }),
    [
      title,
      slug,
      excerpt,
      editor,
      coverImage,
      status,
      featured,
      categoryId,
      tagIds,
      seoTitle,
      seoDescription,
      ogImage,
    ],
  );

  const save = useCallback(
    async (opts?: SaveOpts): Promise<boolean> => {
      const payload = buildPayload();
      if (!payload.title) {
        if (!opts?.silent) toast('Укажите заголовок статьи', 'err');
        return false;
      }
      setSaving(true);
      try {
        if (!articleIdRef.current) {
          const res = await fetch('/api/articles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = (await res.json().catch(() => null)) as {
            article?: { id: string };
            error?: string;
          } | null;
          if (!res.ok || !data?.article) {
            throw new Error(data?.error ?? 'Не удалось создать статью');
          }
          const id = data.article.id;
          articleIdRef.current = id;
          setArticleId(id);
          await fetch(`/api/admin/articles/${id}/versions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: payload.title, content: payload.content }),
          }).catch(() => undefined);
          dirtyRef.current = false;
          setDirty(false);
          setLastSaved(new Date());
          if (!opts?.silent) toast('Статья создана');
          fetchVersions(id);
          router.replace(`/admin/articles/${id}/edit`);
          return true;
        }

        const id = articleIdRef.current;
        const res = await fetch(`/api/articles/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? 'Не удалось сохранить статью');
        }
        if (isAdmin && authorId && authorId !== initialRef.current?.authorId) {
          fetch(`/api/admin/articles/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ authorId }),
          }).catch(() => undefined);
        }
        await fetch(`/api/admin/articles/${id}/versions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: payload.title, content: payload.content }),
        }).catch(() => undefined);
        dirtyRef.current = false;
        setDirty(false);
        setLastSaved(new Date());
        if (!opts?.silent) {
          toast(opts?.target === 'published' || payload.status === 'published'
            ? 'Статья опубликована'
            : 'Черновик сохранён');
        }
        fetchVersions(id);
        return true;
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Не удалось сохранить статью', 'err');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [buildPayload, fetchVersions, isAdmin, authorId, router, toast],
  );

  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    const t = window.setInterval(() => {
      if (dirtyRef.current && articleIdRef.current) {
        void saveRef.current({ silent: true });
      }
    }, 30000);
    return () => window.clearInterval(t);
  }, []);

  function handleTitle(value: string) {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
    markDirty();
  }

  async function runImprove(mode: ImproveMode) {
    if (!menu || !editor) return;
    const before = editor.state.doc.textBetween(menu.from, menu.to, ' ');
    const range = { from: menu.from, to: menu.to };
    setMenu(null);
    setImproveBusy(mode);
    try {
      const res = await fetch('/api/ai/improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: before, mode }),
      });
      if (!res.ok) throw new Error('ai');
      const data = (await res.json().catch(() => null)) as { result?: string } | null;
      if (!data?.result) throw new Error('ai');
      setDiff({ before, after: data.result, range });
    } catch {
      toast(AI_DOWN, 'err');
    } finally {
      setImproveBusy(null);
    }
  }

  function acceptDiff() {
    if (!diff || !editor) return;
    editor
      .chain()
      .focus()
      .deleteRange(diff.range)
      .insertContent(diff.after)
      .run();
    setDiff(null);
    markDirty();
  }

  function requestDraft() {
    if (!editor) return;
    if (editor.getText().trim()) {
      setDraftConfirmOpen(true);
    } else {
      setDraftOpen(true);
    }
  }

  async function generateDraft() {
    if (!draftTopic.trim()) {
      toast('Укажите тему черновика', 'err');
      return;
    }
    setDraftBusy(true);
    try {
      const res = await fetch('/api/ai/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: draftTopic.trim(),
          points: draftPoints.trim() || undefined,
          level: draftLevel,
          style: draftStyle,
        }),
      });
      if (!res.ok) throw new Error('ai');
      const data = (await res.json().catch(() => null)) as {
        title?: string;
        content?: string;
      } | null;
      if (!data?.title || !data.content) throw new Error('ai');
      setTitle(data.title);
      setSlug(slugify(data.title));
      setSlugTouched(true);
      editor?.commands.setContent(data.content, true);
      setStatus('draft');
      markDirty();
      setDraftOpen(false);
      setDraftConfirmOpen(false);
      toast('Черновик сгенерирован. Статус: черновик.');
    } catch {
      toast(AI_DOWN, 'err');
    } finally {
      setDraftBusy(false);
    }
  }

  async function fillMetadata() {
    if (!editor) return;
    setMetaBusy(true);
    try {
      const res = await fetch('/api/ai/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editor.getHTML() }),
      });
      if (!res.ok) throw new Error('ai');
      const data = (await res.json().catch(() => null)) as AiMetadataResult | null;
      if (!data) throw new Error('ai');
      if (data.title) {
        setTitle(data.title);
        setSeoTitle(data.title);
      }
      if (data.description) setSeoDescription(data.description);
      if (data.slug) {
        const next = slugify(data.slug);
        if (!slugTouched) setSlug(next);
      }
      if (data.excerpt) setExcerpt(data.excerpt);
      setSuggestedTags(data.tags ?? []);
      setSuggestedCategory(data.category ?? null);
      markDirty();
      toast('Метаданные заполнены. Проверьте теги и категорию.');
    } catch {
      toast(AI_DOWN, 'err');
    } finally {
      setMetaBusy(false);
    }
  }

  async function checkQuality() {
    if (!editor || qualityBusy) return;
    setQualityBusy(true);
    try {
      const res = await fetch('/api/ai/quality-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editor.getHTML(), title: title || 'Без заголовка' }),
      });
      const data = (await res.json().catch(() => null)) as
        | { score?: number; issues?: string[]; suggestions?: string[]; error?: string }
        | null;
      if (!res.ok || !data || typeof data.score !== 'number') throw new Error(data?.error ?? 'ai');
      setQuality({ score: data.score, issues: data.issues ?? [], suggestions: data.suggestions ?? [] });
      toast(`Качество: ${data.score}/100`);
    } catch {
      toast(AI_DOWN, 'err');
    } finally {
      setQualityBusy(false);
    }
  }

  async function suggestTags() {
    if (!editor || autoTagsBusy) return;
    setAutoTagsBusy(true);
    try {
      const res = await fetch('/api/ai/auto-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editor.getHTML(), title: title || 'Без заголовка' }),
      });
      const data = (await res.json().catch(() => null)) as
        | { suggestedTags?: { name: string }[]; error?: string }
        | null;
      if (!res.ok || !data?.suggestedTags) throw new Error(data?.error ?? 'ai');
      const names = data.suggestedTags.map((t) => t.name).filter(Boolean);
      setSuggestedTags((prev) => Array.from(new Set([...prev, ...names])));
      toast(names.length > 0 ? `Предложено тегов: ${names.length}` : 'Новых тегов не найдено');
    } catch {
      toast(AI_DOWN, 'err');
    } finally {
      setAutoTagsBusy(false);
    }
  }

  async function createTagByName(name: string): Promise<TagRow | null> {
    const res = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    let tag: TagRow | null = null;
    if (data && typeof data === 'object') {
      const nested = data.tag;
      if (nested && typeof nested === 'object') {
        const t = nested as Partial<TagRow>;
        if (t.id && t.name) tag = { id: t.id, name: t.name, slug: t.slug ?? slugify(name) };
      } else if (typeof data.id === 'string' && typeof data.name === 'string') {
        tag = { id: data.id, name: data.name, slug: typeof data.slug === 'string' && data.slug ? data.slug : slugify(name) };
      } else if (typeof (data as { error?: string }).error === 'string') {
        const errTag = (data as { tag?: TagRow }).tag;
        if (errTag?.id) return errTag;
        toast((data as { error: string }).error, 'err');
        return null;
      }
    }
    if (!tag) {
      toast('Не удалось создать тег', 'err');
      return null;
    }
    const createdTag = tag;
    setTags((prev) => (prev.some((t) => t.id === createdTag.id) ? prev : [...prev, createdTag]));
    return createdTag;
  }

  async function addSuggestedTag(name: string) {
    const lower = name.trim().toLowerCase();
    const found = tags.find((t) => t.name.toLowerCase() === lower || t.slug === slugify(name));
    let id = found?.id;
    if (!id) {
      const created = await createTagByName(name.trim());
      if (!created) return;
      id = created.id;
    }
    const finalId = id;
    setTagIds((prev) => (prev.includes(finalId) ? prev : [...prev, finalId]));
    setSuggestedTags((prev) => prev.filter((t) => t !== name));
    markDirty();
  }

  function applySuggestedCategory() {
    if (!suggestedCategory) return;
    const found = categories.find(
      (c) => c.slug === suggestedCategory || slugify(c.name) === slugify(suggestedCategory),
    );
    if (!found) {
      toast('Предложенная категория не найдена среди существующих', 'err');
      return;
    }
    setCategoryId(found.id);
    setSuggestedCategory(null);
    markDirty();
  }

  async function handleCoverFile(file: File) {
    setCoverBusy(true);
    try {
      const url = await uploadFile(file, 'images');
      setCoverImage(url);
      markDirty();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Не удалось загрузить обложку', 'err');
    } finally {
      setCoverBusy(false);
    }
  }

  async function insertImageFile(file: File) {
    setImageBusy(true);
    try {
      const url = await uploadFile(file, 'images');
      editor?.chain().focus().setImage({ src: url }).run();
      markDirty();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Не удалось загрузить изображение', 'err');
    } finally {
      setImageBusy(false);
    }
  }

  async function insertGallery(files: FileList) {
    const list = Array.from(files).slice(0, 12);
    setImageBusy(true);
    try {
      const urls: string[] = [];
      for (let i = 0; i < list.length; i += 3) {
        const chunk = list.slice(i, i + 3);
        const done = await Promise.all(chunk.map((f) => uploadFile(f, 'images')));
        urls.push(...done);
      }
      editor
        ?.chain()
        .focus()
        .insertContent(urls.map((src) => ({ type: 'image', attrs: { src } })))
        .run();
      markDirty();
      toast(`Добавлено изображений: ${urls.length}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Не удалось загрузить галерею', 'err');
    } finally {
      setImageBusy(false);
    }
  }

  async function insertVideoFile(file: File) {
    setVideoBusy(true);
    try {
      const url = await uploadFile(file, 'videos');
      editor
        ?.chain()
        .focus()
        .insertContent({ type: 'htmlVideo', attrs: { src: url, controls: true } })
        .run();
      markDirty();
      setVideoOpen(false);
      setVideoUrl('');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Не удалось загрузить видео', 'err');
    } finally {
      setVideoBusy(false);
    }
  }

  function insertVideoFromUrl() {
    const embed = embedUrl(videoUrl);
    if (!embed) {
      toast('Поддерживаются ссылки YouTube и Vimeo', 'err');
      return;
    }
    editor?.chain().focus().insertContent({ type: 'iframeEmbed', attrs: { src: embed } }).run();
    markDirty();
    setVideoOpen(false);
    setVideoUrl('');
  }

  async function restoreVersion(v: VersionRow) {
    if (!window.confirm(`Восстановить версию от ${formatDate(v.createdAt)}?`)) return;
    try {
      const res = await fetch(`/api/admin/articles/versions/${v.id}/restore`, {
        method: 'PUT',
      });
      if (!res.ok) throw new Error('fail');
      const data = (await res.json()) as { article: { title: string; content: string } };
      editor?.commands.setContent(data.article.content, true);
      setTitle(data.article.title);
      markDirty();
      toast('Версия восстановлена. Не забудьте сохранить.');
      if (articleId) fetchVersions(articleId);
    } catch {
      toast('Не удалось восстановить версию', 'err');
    }
  }

  async function doPreview() {
    const ok = await save();
    if (!ok) return;
    if (status === 'published') {
      window.open(`/article/${slug.trim() || slugify(title)}`, '_blank', 'noopener');
    } else {
      setPreviewOpen(true);
    }
  }

  const showDraftButton = !initial || !initial.content.trim();
  const selectedTags = tags.filter((t) => tagIds.includes(t.id));
  const availableTags = tags.filter((t) => !tagIds.includes(t.id));
  const editors = users.filter((u) => u.role === 'EDITOR' || u.role === 'ADMIN');
  const savedLabel = lastSaved
    ? `Сохранено ${lastSaved.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
    : null;

  return (
    <div className="space-y-4 max-w-6xl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/articles" className="btn-ghost !px-2.5">
            К списку
          </Link>
          <h1 className="font-display text-h2 font-bold">
            {initial ? 'Редактирование статьи' : 'Новая статья'}
          </h1>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted">
          {dirty ? (
            <span className="text-accent">Есть несохранённые изменения</span>
          ) : savedLabel ? (
            <span>{savedLabel}</span>
          ) : null}
          {saving ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 size={13} className="animate-spin" />
              Сохранение
            </span>
          ) : null}
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="flex-1 min-w-0 space-y-3">
          <div className="card p-2 flex flex-wrap items-center gap-1">
            <TBtn
              title="Заголовок 1"
              active={editor?.isActive('heading', { level: 1 })}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
            >
              <Heading1 size={17} />
            </TBtn>
            <TBtn
              title="Заголовок 2"
              active={editor?.isActive('heading', { level: 2 })}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            >
              <Heading2 size={17} />
            </TBtn>
            <TBtn
              title="Заголовок 3"
              active={editor?.isActive('heading', { level: 3 })}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
            >
              <Heading3 size={17} />
            </TBtn>
            <span className="w-px h-5 bg-line mx-1" />
            <TBtn
              title="Полужирный"
              active={editor?.isActive('bold')}
              onClick={() => editor?.chain().focus().toggleBold().run()}
            >
              <Bold size={16} />
            </TBtn>
            <TBtn
              title="Курсив"
              active={editor?.isActive('italic')}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            >
              <Italic size={16} />
            </TBtn>
            <TBtn
              title="Подчёркнутый"
              active={editor?.isActive('underline')}
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
            >
              <Underline size={16} />
            </TBtn>
            <span className="w-px h-5 bg-line mx-1" />
            <TBtn
              title="Маркированный список"
              active={editor?.isActive('bulletList')}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            >
              <List size={16} />
            </TBtn>
            <TBtn
              title="Нумерованный список"
              active={editor?.isActive('orderedList')}
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            >
              <ListOrdered size={16} />
            </TBtn>
            <TBtn
              title="Цитата"
              active={editor?.isActive('blockquote')}
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            >
              <Quote size={16} />
            </TBtn>
            <TBtn
              title="Блок кода"
              active={editor?.isActive('codeBlock')}
              onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
            >
              <Code size={16} />
            </TBtn>
            <span className="w-px h-5 bg-line mx-1" />
            <TBtn
              title="Ссылка"
              active={editor?.isActive('link')}
              onClick={() => {
                setLinkUrl(editor?.getAttributes('link').href ?? '');
                setLinkOpen(true);
              }}
            >
              <LinkIcon size={16} />
            </TBtn>
            <TBtn title="Изображение" onClick={() => imageInputRef.current?.click()}>
              {imageBusy ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
            </TBtn>
            <TBtn title="Видео" onClick={() => setVideoOpen(true)}>
              <Video size={16} />
            </TBtn>
            <TBtn title="Галерея" onClick={() => galleryInputRef.current?.click()}>
              <Images size={16} />
            </TBtn>
            <TBtn title="Разделитель" onClick={() => editor?.chain().focus().setHorizontalRule().run()}>
              <Minus size={16} />
            </TBtn>
            <TBtn
              title="Таблица"
              active={editor?.isActive('table')}
              onClick={() => setTableOpen(true)}
            >
              <TableIcon size={16} />
            </TBtn>
            <div className="flex-1" />
            {showDraftButton ? (
              <button
                type="button"
                className="btn-secondary !py-1.5 !px-3 text-xs"
                onClick={requestDraft}
                disabled={draftBusy}
              >
                <PenLine size={15} />
                Сгенерировать черновик
              </button>
            ) : null}
          </div>

          <div className="card px-5 py-1">
            {editor ? (
              <EditorContent editor={editor} className="prose-wiki min-h-[420px]" />
            ) : (
              <div className="min-h-[420px] flex items-center justify-center text-sm text-muted">
                Загрузка редактора...
              </div>
            )}
          </div>

          <div className="card">
            <button
              type="button"
              className="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium"
              onClick={() => setVersionsOpen((v) => !v)}
            >
              <span className="inline-flex items-center gap-2">
                <History size={16} className="text-muted" />
                История версий
                {articleId ? ` (${versions.length})` : ''}
              </span>
              <ChevronDown
                size={16}
                className={cn('text-muted transition-transform duration-150', versionsOpen && 'rotate-180')}
              />
            </button>
            {versionsOpen ? (
              <div className="border-t border-line divide-y divide-line/70">
                {!articleId ? (
                  <p className="px-4 py-3 text-sm text-muted">
                    Версии появятся после первого сохранения.
                  </p>
                ) : versions.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted">Версий пока нет.</p>
                ) : (
                  versions.map((v) => (
                    <div key={v.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm truncate">{v.title}</div>
                        <div className="text-xs text-muted">
                          {formatDate(v.createdAt)}
                          {v.createdBy ? ` · ${v.createdBy.name}` : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn-secondary !py-1 !px-2.5 text-xs shrink-0"
                        onClick={() => restoreVersion(v)}
                      >
                        <RotateCcw size={13} />
                        Откатить
                      </button>
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </div>

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) insertImageFile(f);
              e.target.value = '';
            }}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) insertGallery(e.target.files);
              e.target.value = '';
            }}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) insertVideoFile(f);
              e.target.value = '';
            }}
          />
        </div>

        <aside className="w-full lg:w-[320px] shrink-0 space-y-4 lg:sticky lg:top-4">
          <div className="card p-4 space-y-4">
            <div>
              <label className="label">Заголовок</label>
              <input
                className="input"
                value={title}
                onChange={(e) => handleTitle(e.target.value)}
                placeholder="Название статьи"
              />
            </div>
            <div>
              <label className="label">Слаг</label>
              <input
                className="input font-mono text-xs"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugTouched(true);
                  markDirty();
                }}
                placeholder="url-adres"
              />
            </div>
            <div>
              <label className="label">Краткое описание</label>
              <textarea
                className="input min-h-[72px] resize-y"
                value={excerpt}
                onChange={(e) => {
                  setExcerpt(e.target.value);
                  markDirty();
                }}
                placeholder="Одно-два предложения для каталога и SEO"
              />
            </div>
            <div>
              <label className="label">Обложка</label>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f && f.type.startsWith('image/')) handleCoverFile(f);
                }}
                className={cn(
                  'rounded-md border border-dashed p-3 text-center transition-colors duration-150',
                  dragOver ? 'border-primary bg-primary/5' : 'border-line',
                )}
              >
                {coverImage ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={coverImage}
                      alt="Обложка"
                      className="w-full h-32 object-cover rounded-sm border border-line"
                    />
                    <button
                      type="button"
                      className="absolute top-1.5 right-1.5 btn-ghost !bg-surface border border-line !px-1.5 !py-1"
                      onClick={() => {
                        setCoverImage(null);
                        markDirty();
                      }}
                      aria-label="Убрать обложку"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-muted">
                    {coverBusy ? 'Загрузка...' : 'Перетащите изображение сюда'}
                  </p>
                )}
                <button
                  type="button"
                  className="btn-secondary w-full mt-2 !py-1.5 text-xs"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={coverBusy}
                >
                  <Upload size={14} />
                  Выбрать файл
                </button>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleCoverFile(f);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>
          </div>

          <div className="card p-4 space-y-4">
            <div>
              <label className="label">Категория</label>
              <select
                className="input"
                value={categoryId ?? ''}
                onChange={(e) => {
                  setCategoryId(e.target.value || null);
                  markDirty();
                }}
              >
                <option value="">Без категории</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Теги</label>
              {selectedTags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedTags.map((t) => (
                    <span key={t.id} className="badge !rounded-full gap-1">
                      {t.name}
                      <button
                        type="button"
                        onClick={() => {
                          setTagIds((prev) => prev.filter((id) => id !== t.id));
                          markDirty();
                        }}
                        aria-label={`Убрать тег ${t.name}`}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted mb-2">Теги не выбраны</p>
              )}
              <div className="flex gap-2">
                <select
                  className="input !text-xs"
                  value=""
                  onChange={(e) => {
                    const id = e.target.value;
                    if (!id) return;
                    setTagIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
                    markDirty();
                  }}
                >
                  <option value="">Добавить существующий</option>
                  {availableTags.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 mt-2">
                <input
                  className="input !text-xs"
                  placeholder="Новый тег"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && newTag.trim()) {
                      e.preventDefault();
                      const tag = await createTagByName(newTag.trim());
                      if (tag) {
                        setTagIds((prev) => (prev.includes(tag.id) ? prev : [...prev, tag.id]));
                        setNewTag('');
                        markDirty();
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn-secondary !px-2.5"
                  aria-label="Создать тег"
                  onClick={async () => {
                    if (!newTag.trim()) return;
                    const tag = await createTagByName(newTag.trim());
                    if (tag) {
                      setTagIds((prev) => (prev.includes(tag.id) ? prev : [...prev, tag.id]));
                      setNewTag('');
                      markDirty();
                    }
                  }}
                >
                  <Plus size={15} />
                </button>
              </div>
            </div>
            <div>
              <label className="label">Статус</label>
              <select
                className="input"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as ArticleStatus);
                  markDirty();
                }}
              >
                <option value="draft">Черновик</option>
                <option value="published">Опубликована</option>
                <option value="archived">В архиве</option>
              </select>
            </div>
            {isAdmin && editors.length > 0 ? (
              <div>
                <label className="label">Автор</label>
                <select
                  className="input"
                  value={authorId}
                  onChange={(e) => {
                    setAuthorId(e.target.value);
                    markDirty();
                  }}
                >
                  <option value="">Не выбран</option>
                  {editors.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          <div className="card p-4 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="font-display font-semibold text-sm">SEO</h2>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  className="btn-secondary !border-violet-300 !text-violet-700 hover:!bg-violet-50 !py-1 !px-2.5 text-xs"
                  onClick={() => void suggestTags()}
                  disabled={autoTagsBusy}
                >
                  {autoTagsBusy ? 'Теги...' : 'Авто-теги'}
                </button>
                <button
                  type="button"
                  className="btn-secondary !border-violet-300 !text-violet-700 hover:!bg-violet-50 !py-1 !px-2.5 text-xs"
                  onClick={() => void checkQuality()}
                  disabled={qualityBusy}
                >
                  <BookOpen size={14} />
                  {qualityBusy ? 'Проверяем...' : 'Качество'}
                </button>
                <button
                  type="button"
                  className="btn-secondary !border-violet-300 !text-violet-700 hover:!bg-violet-50 !py-1 !px-2.5 text-xs"
                  onClick={fillMetadata}
                  disabled={metaBusy}
                >
                  {metaBusy ? 'Запрашиваем...' : 'Заполнить AI'}
                </button>
              </div>
            </div>
            {quality ? (
              <div className="rounded-lg border border-line bg-surface-soft/50 p-3 text-sm space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display font-semibold text-sm">Оценка качества</span>
                  <span className="mono-meta text-primary">{quality.score}/100</span>
                </div>
                {quality.issues.length > 0 ? (
                  <ul className="list-disc pl-4 space-y-1 text-xs text-muted">
                    {quality.issues.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                ) : null}
                {quality.suggestions.length > 0 ? (
                  <ul className="list-disc pl-4 space-y-1 text-xs text-muted">
                    {quality.suggestions.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                ) : null}
                <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setQuality(null)}>
                  Скрыть
                </button>
              </div>
            ) : null}
            <div>
              <label className="label">SEO заголовок</label>
              <input
                className="input"
                value={seoTitle}
                onChange={(e) => {
                  setSeoTitle(e.target.value);
                  markDirty();
                }}
              />
            </div>
            <div>
              <label className="label">SEO описание</label>
              <textarea
                className="input min-h-[64px] resize-y"
                value={seoDescription}
                onChange={(e) => {
                  setSeoDescription(e.target.value);
                  markDirty();
                }}
              />
            </div>
            <div>
              <label className="label">OG изображение (URL)</label>
              <input
                className="input text-xs"
                value={ogImage}
                onChange={(e) => {
                  setOgImage(e.target.value);
                  markDirty();
                }}
                placeholder="https://..."
              />
            </div>
            {suggestedTags.length > 0 ? (
              <div>
                <div className="label">Предложенные теги</div>
                <div className="flex flex-wrap gap-1.5">
                  {suggestedTags.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className="badge !rounded-full hover:border-primary/60 hover:text-primary"
                      onClick={() => addSuggestedTag(t)}
                    >
                      <Plus size={12} className="mr-0.5" />
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {suggestedCategory ? (
              <div>
                <div className="label">Предложенная категория</div>
                <button type="button" className="badge" onClick={applySuggestedCategory}>
                  {suggestedCategory}
                </button>
              </div>
            ) : null}
          </div>

          <div className="card p-4 space-y-2">
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="btn-secondary w-full"
                onClick={() => save({ target: 'draft' })}
                disabled={saving}
              >
                Сохранить черновик
              </button>
              <button
                type="button"
                className="btn-primary w-full"
                onClick={() => save({ target: 'published' })}
                disabled={saving}
              >
                Опубликовать
              </button>
              <button type="button" className="btn-ghost w-full" onClick={doPreview} disabled={saving}>
                <Eye size={16} />
                Предпросмотр
              </button>
            </div>
            {savedLabel ? <p className="text-xs text-muted text-center">{savedLabel}</p> : null}
          </div>
        </aside>
      </div>

      {menu ? (
        <div
          className="fixed z-40 -translate-x-1/2 mt-1"
          style={{ left: menu.x, top: menu.y }}
        >
          <div className="card rounded-lg p-1.5 flex flex-wrap gap-1 max-w-[320px]">
            {improveModes.map(({ mode, label, Icon }) => (
              <button
                key={mode}
                type="button"
                className="btn-ghost !py-1 !px-2 text-xs"
                disabled={improveBusy !== null}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => runImprove(mode)}
              >
                {improveBusy === mode ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Icon size={13} />
                )}
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <Modal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        title="Ссылка"
        footer={
          <>
            {editor?.isActive('link') ? (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  editor.chain().focus().unsetLink().run();
                  setLinkOpen(false);
                }}
              >
                Убрать ссылку
              </button>
            ) : null}
            <button type="button" className="btn-secondary" onClick={() => setLinkOpen(false)}>
              Отмена
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                if (!linkUrl.trim()) {
                  editor?.chain().focus().unsetLink().run();
                } else {
                  editor?.chain().focus().setLink({ href: linkUrl.trim() }).run();
                }
                setLinkOpen(false);
              }}
            >
              Применить
            </button>
          </>
        }
      >
        <label className="label">URL</label>
        <input
          className="input"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          placeholder="https://example.com"
          autoFocus
        />
      </Modal>

      <Modal
        open={videoOpen}
        onClose={() => setVideoOpen(false)}
        title="Видео"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setVideoOpen(false)}>
              Отмена
            </button>
            {videoTab === 'url' ? (
              <button type="button" className="btn-primary" onClick={insertVideoFromUrl}>
                Вставить
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary"
                onClick={() => videoInputRef.current?.click()}
                disabled={videoBusy}
              >
                {videoBusy ? 'Загрузка...' : 'Выбрать файл'}
              </button>
            )}
          </>
        }
      >
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            className={cn('btn-secondary text-xs', videoTab === 'url' && 'bg-ink/8')}
            onClick={() => setVideoTab('url')}
          >
            Ссылка YouTube или Vimeo
          </button>
          <button
            type="button"
            className={cn('btn-secondary text-xs', videoTab === 'file' && 'bg-ink/8')}
            onClick={() => setVideoTab('file')}
          >
            Загрузить файл
          </button>
        </div>
        {videoTab === 'url' ? (
          <>
            <label className="label">Ссылка на видео</label>
            <input
              className="input"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              autoFocus
            />
            <p className="text-xs text-muted mt-2">
              Файл видео вставляется вкладкой «Загрузить файл», лимит 100 МБ.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted">
            Поддерживаются mp4 и другие браузерные форматы, до 100 МБ.
          </p>
        )}
      </Modal>

      <Modal
        open={tableOpen}
        onClose={() => setTableOpen(false)}
        title="Таблица"
        footer={
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              editor
                ?.chain()
                .focus()
                .insertTable({ rows: tableRows, cols: tableCols, withHeaderRow: true })
                .run();
              markDirty();
              setTableOpen(false);
            }}
          >
            Вставить
          </button>
        }
      >
        <div className="flex items-center gap-4">
          <div>
            <label className="label">Строк</label>
            <input
              type="number"
              min={1}
              max={30}
              className="input !w-24"
              value={tableRows}
              onChange={(e) => setTableRows(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
          <div>
            <label className="label">Колонок</label>
            <input
              type="number"
              min={1}
              max={12}
              className="input !w-24"
              value={tableCols}
              onChange={(e) => setTableCols(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
        </div>
        {editor?.isActive('table') ? (
          <div className="mt-4 pt-4 border-t border-line">
            <div className="label">Изменить текущую таблицу</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => editor.chain().focus().addRowAfter().run()}
              >
                Строка ниже
              </button>
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => editor.chain().focus().deleteRow().run()}
              >
                Удалить строку
              </button>
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => editor.chain().focus().addColumnAfter().run()}
              >
                Колонка справа
              </button>
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => editor.chain().focus().deleteColumn().run()}
              >
                Удалить колонку
              </button>
              <button
                type="button"
                className="btn-danger text-xs"
                onClick={() => editor.chain().focus().deleteTable().run()}
              >
                Удалить таблицу
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={draftConfirmOpen}
        onClose={() => setDraftConfirmOpen(false)}
        title="Заменить содержимое?"
        footer={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setDraftConfirmOpen(false)}
            >
              Отмена
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setDraftConfirmOpen(false);
                setDraftOpen(true);
              }}
            >
              Продолжить
            </button>
          </>
        }
      >
        <p className="text-sm text-muted">
          В статье уже есть текст. Сгенерированный черновик заменит его полностью.
        </p>
      </Modal>

      <Modal
        open={draftOpen}
        onClose={() => setDraftOpen(false)}
        title="Черновик статьи"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setDraftOpen(false)}>
              Отмена
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={generateDraft}
              disabled={draftBusy}
            >
              {draftBusy ? 'Генерируем...' : 'Сгенерировать'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">Тема</label>
            <input
              className="input"
              value={draftTopic}
              onChange={(e) => setDraftTopic(e.target.value)}
              placeholder="Например: История периодической таблицы"
            />
          </div>
          <div>
            <label className="label">Ключевые пункты</label>
            <textarea
              className="input min-h-[72px] resize-y"
              value={draftPoints}
              onChange={(e) => setDraftPoints(e.target.value)}
              placeholder="Что обязательно должно быть в статье, через запятую"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label">Детализация</label>
              <select
                className="input"
                value={draftLevel}
                onChange={(e) => setDraftLevel(e.target.value)}
              >
                <option value="кратко">Кратко</option>
                <option value="стандарт">Стандарт</option>
                <option value="подробно">Подробно</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="label">Стиль</label>
              <select
                className="input"
                value={draftStyle}
                onChange={(e) => setDraftStyle(e.target.value)}
              >
                <option value="энциклопедический">Энциклопедический</option>
                <option value="простой">Простой</option>
                <option value="академический">Академический</option>
                <option value="публицистический">Публицистический</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-muted">
            После генерации статья останется черновиком. Публиковать её нужно вручную.
          </p>
        </div>
      </Modal>

      <Modal
        open={Boolean(diff)}
        onClose={() => setDiff(null)}
        title="Результат улучшения"
        size="lg"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setDiff(null)}>
              Отклонить
            </button>
            <button type="button" className="btn-primary" onClick={acceptDiff}>
              Принять
            </button>
          </>
        }
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <div className="label">Было</div>
            <div className="rounded-sm border border-line bg-bg p-3 text-sm whitespace-pre-wrap max-h-80 overflow-y-auto">
              {diff?.before}
            </div>
          </div>
          <div>
            <div className="label">Стало</div>
            <div className="prose-wiki !text-sm rounded-sm border border-primary/40 bg-primary/5 p-3 max-h-80 overflow-y-auto">
              {diff ? <div dangerouslySetInnerHTML={{ __html: diff.after }} /> : null}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Черновик не виден публике"
        footer={
          <button type="button" className="btn-primary" onClick={() => setPreviewOpen(false)}>
            Понятно
          </button>
        }
      >
        <p className="text-sm text-muted">
          Статья сохранена как черновик. Страница откроется только после публикации.
        </p>
      </Modal>
    </div>
  );
}
