'use client';

import { useEffect, useState } from 'react';
import { Palette } from 'lucide-react';
import { useToast } from '@/components/admin/ToastProvider';

interface SiteSettings {
  siteName: string;
  logo: string;
  primaryColor: string;
  accentColor: string;
  seoDefaultTitle: string;
  seoDefaultDescription: string;
  socials: { telegram: string; vk: string; youtube: string };
  homeText: string;
}

const defaults: SiteSettings = {
  siteName: 'WikiNova',
  logo: '',
  primaryColor: '#166534',
  accentColor: '#C2410C',
  seoDefaultTitle: 'WikiNova',
  seoDefaultDescription: 'Локальная энциклопедия: статьи, категории, AI-ассистент.',
  socials: { telegram: '', vk: '', youtube: '' },
  homeText: '',
};

function hexToRgbTriplet(hex: string): string | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `${r} ${g} ${b}`;
}

export default function SettingsPage() {
  const toast = useToast();
  const [form, setForm] = useState<SiteSettings>(defaults);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => (r.ok ? r.json() : { settings: defaults }))
      .then((d: { settings?: SiteSettings }) => setForm(d.settings ?? defaults))
      .catch(() => toast('Не удалось загрузить настройки', 'err'))
      .finally(() => setLoading(false));
  }, [toast]);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? 'Не удалось сохранить настройки');
      toast('Настройки сохранены');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка сохранения', 'err');
    } finally {
      setBusy(false);
    }
  }

  function applyColors() {
    const primary = hexToRgbTriplet(form.primaryColor);
    const accent = hexToRgbTriplet(form.accentColor);
    if (!primary || !accent) {
      toast('Цвета должны быть в формате #RRGGBB', 'err');
      return;
    }
    const root = document.documentElement;
    if (root.classList.contains('dark')) {
      toast('В тёмной теме палитра по умолчанию не меняется', 'err');
      return;
    }
    root.style.setProperty('--c-primary', primary);
    root.style.setProperty('--c-accent', accent);
    toast('Цвета применены');
  }

  if (loading) return <p className="text-sm text-muted">Загрузка...</p>;

  return (
    <div className="space-y-5 max-w-3xl">
      <header>
        <h1 className="font-display text-h2 font-bold">Настройки сайта</h1>
        <p className="text-sm text-muted mt-1">Название, палитра, SEO и контакты</p>
      </header>

      <section className="card p-5 space-y-4">
        <h2 className="font-display font-semibold">Основное</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Название сайта</label>
            <input
              className="input"
              value={form.siteName}
              onChange={(e) => setForm((f) => ({ ...f, siteName: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Логотип (URL)</label>
            <input
              className="input text-xs"
              value={form.logo}
              onChange={(e) => setForm((f) => ({ ...f, logo: e.target.value }))}
              placeholder="/uploads/images/logo.png"
            />
          </div>
        </div>
        <div>
          <label className="label">Текст главной страницы</label>
          <textarea
            className="input min-h-[110px] resize-y"
            value={form.homeText}
            onChange={(e) => setForm((f) => ({ ...f, homeText: e.target.value }))}
            placeholder="Короткое представление проекта"
          />
        </div>
      </section>

      <section className="card p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display font-semibold inline-flex items-center gap-2">
            <Palette size={16} className="text-muted" />
            Цвета
          </h2>
          <button type="button" className="btn-secondary" onClick={applyColors}>
            Применить цвета
          </button>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Основной цвет</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-9 h-9 rounded-md border border-line bg-surface p-0.5"
                value={form.primaryColor}
                onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
              />
              <input
                className="input font-mono text-xs"
                value={form.primaryColor}
                onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="label">Акцентный цвет</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-9 h-9 rounded-md border border-line bg-surface p-0.5"
                value={form.accentColor}
                onChange={(e) => setForm((f) => ({ ...f, accentColor: e.target.value }))}
              />
              <input
                className="input font-mono text-xs"
                value={form.accentColor}
                onChange={(e) => setForm((f) => ({ ...f, accentColor: e.target.value }))}
              />
            </div>
          </div>
        </div>
        <p className="text-xs text-muted">
          «Применить цвета» обновляет CSS-переменные на текущей странице без сохранения.
        </p>
      </section>

      <section className="card p-5 space-y-4">
        <h2 className="font-display font-semibold">SEO по умолчанию</h2>
        <div>
          <label className="label">Заголовок</label>
          <input
            className="input"
            value={form.seoDefaultTitle}
            onChange={(e) => setForm((f) => ({ ...f, seoDefaultTitle: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Описание</label>
          <textarea
            className="input min-h-[72px] resize-y"
            value={form.seoDefaultDescription}
            onChange={(e) => setForm((f) => ({ ...f, seoDefaultDescription: e.target.value }))}
          />
        </div>
      </section>

      <section className="card p-5 space-y-4">
        <h2 className="font-display font-semibold">Социальные сети</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="label">Telegram</label>
            <input
              className="input text-xs"
              value={form.socials.telegram}
              onChange={(e) =>
                setForm((f) => ({ ...f, socials: { ...f.socials, telegram: e.target.value } }))
              }
              placeholder="https://t.me/..."
            />
          </div>
          <div>
            <label className="label">ВКонтакте</label>
            <input
              className="input text-xs"
              value={form.socials.vk}
              onChange={(e) =>
                setForm((f) => ({ ...f, socials: { ...f.socials, vk: e.target.value } }))
              }
              placeholder="https://vk.com/..."
            />
          </div>
          <div>
            <label className="label">YouTube</label>
            <input
              className="input text-xs"
              value={form.socials.youtube}
              onChange={(e) =>
                setForm((f) => ({ ...f, socials: { ...f.socials, youtube: e.target.value } }))
              }
              placeholder="https://youtube.com/..."
            />
          </div>
        </div>
      </section>

      <div className="flex gap-2">
        <button type="button" className="btn-primary" onClick={save} disabled={busy}>
          {busy ? 'Сохранение...' : 'Сохранить настройки'}
        </button>
      </div>
    </div>
  );
}
