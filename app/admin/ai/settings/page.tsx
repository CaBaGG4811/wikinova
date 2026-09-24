'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, RefreshCw } from 'lucide-react';
import type { AiSettingsAdmin } from '@/lib/ai/settings';

const PRESETS: { id: string; label: string; baseUrl: string }[] = [
  { id: 'lmstudio', label: 'LM Studio', baseUrl: 'http://host.docker.internal:1234/v1' },
  { id: 'ollama', label: 'Ollama', baseUrl: 'http://localhost:11434/v1' },
  { id: 'vllm', label: 'vLLM', baseUrl: 'http://localhost:8000/v1' },
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
  { id: 'custom', label: 'Свой вариант', baseUrl: '' },
];

const FEATURE_LABELS: { key: string; label: string }[] = [
  { key: 'summary', label: 'Краткий пересказ' },
  { key: 'qa_article', label: 'Q&A по статье' },
  { key: 'qa_global', label: 'Q&A по базе' },
  { key: 'draft', label: 'Черновики' },
  { key: 'translate', label: 'Переводы' },
  { key: 'factcheck', label: 'Fact-check' },
  { key: 'web_search', label: 'Web search в Q&A' },
  { key: 'embeddings', label: 'Embeddings' },
];

const LANG_CHOICES = ['ru', 'en', 'de', 'fr', 'es', 'zh', 'it', 'pt', 'ja'];

interface TestResult {
  ok: boolean;
  text: string;
}

function presetFor(baseUrl: string): string {
  const found = PRESETS.find((p) => p.baseUrl && p.baseUrl === baseUrl);
  return found ? found.id : 'custom';
}

export default function AiSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const [preset, setPreset] = useState('custom');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [clearKey, setClearKey] = useState(false);
  const [apiKeyMasked, setApiKeyMasked] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [model, setModel] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [timeoutSec, setTimeoutSec] = useState(60);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);
  const [features, setFeatures] = useState<string[]>([]);
  const [extraFeatures, setExtraFeatures] = useState<string[]>([]);
  const [rateLimitUser, setRateLimitUser] = useState(30);
  const [rateLimitAnon, setRateLimitAnon] = useState(10);
  const [logEnabled, setLogEnabled] = useState(true);
  const [newLang, setNewLang] = useState('');
  const [test, setTest] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const extraRef = useRef<string[]>([]);

  const applySettings = useCallback((data: AiSettingsAdmin) => {
    setBaseUrl(data.baseUrl);
    setPreset(presetFor(data.baseUrl));
    setModel(data.model);
    setTemperature(data.temperature);
    setMaxTokens(data.maxTokens);
    setTimeoutSec(Math.round(data.timeoutMs / 1000));
    setSystemPrompt(data.systemPrompt);
    setLanguages(data.languages);
    setFeatures(data.features.filter((f) => FEATURE_LABELS.some((l) => l.key === f)));
    const extras = data.features.filter((f) => !FEATURE_LABELS.some((l) => l.key === f));
    setExtraFeatures(extras);
    extraRef.current = extras;
    setRateLimitUser(data.rateLimitUser);
    setRateLimitAnon(data.rateLimitAnon);
    setLogEnabled(data.logEnabled);
    setApiKeyMasked(data.apiKeyMasked);
    setHasApiKey(data.hasApiKey);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/ai/settings');
        const data = (await res.json().catch(() => null)) as AiSettingsAdmin | { error?: string } | null;
        if (cancelled) return;
        if (!res.ok || !data || !('baseUrl' in data)) {
          setLoadError((data as { error?: string } | null)?.error ?? `Ошибка загрузки (${res.status})`);
        } else {
          applySettings(data);
        }
      } catch {
        if (!cancelled) setLoadError('Не удалось загрузить настройки.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applySettings]);

  function toggleFeature(key: string) {
    setFeatures((prev) => (prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]));
  }

  function toggleLang(code: string) {
    setLanguages((prev) => (prev.includes(code) ? prev.filter((l) => l !== code) : [...prev, code]));
  }

  async function save() {
    setSaving(true);
    setSavedNote(null);
    setTest(null);
    try {
      const res = await fetch('/api/admin/ai/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl,
          model,
          temperature,
          maxTokens,
          timeoutMs: timeoutSec * 1000,
          systemPrompt,
          languages,
          features: [...features, ...extraRef.current],
          rateLimitUser,
          rateLimitAnon,
          logEnabled,
          ...(apiKeyInput.trim() ? { apiKey: apiKeyInput.trim() } : {}),
          ...(clearKey ? { clearKey: true } : {}),
        }),
      });
      const data = (await res.json().catch(() => null)) as AiSettingsAdmin | { error?: string } | null;
      if (!res.ok || !data || !('baseUrl' in data)) {
        setSavedNote((data as { error?: string } | null)?.error ?? `Ошибка сохранения (${res.status})`);
        return;
      }
      applySettings(data);
      setApiKeyInput('');
      setClearKey(false);
      setShowKey(false);
      setSavedNote('Сохранено');
      window.setTimeout(() => setSavedNote(null), 2500);
    } catch {
      setSavedNote('Не удалось сохранить: сервер недоступен.');
    } finally {
      setSaving(false);
    }
  }

  async function resetToEnv() {
    if (!window.confirm('Сбросить настройки AI к значениям из .env?')) return;
    setSaving(true);
    setSavedNote(null);
    try {
      const res = await fetch('/api/admin/ai/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: true }),
      });
      const data = (await res.json().catch(() => null)) as AiSettingsAdmin | { error?: string } | null;
      if (!res.ok || !data || !('baseUrl' in data)) {
        setSavedNote((data as { error?: string } | null)?.error ?? `Ошибка сброса (${res.status})`);
        return;
      }
      applySettings(data);
      setApiKeyInput('');
      setClearKey(false);
      setSavedNote('Настройки сброшены к .env');
      window.setTimeout(() => setSavedNote(null), 2500);
    } catch {
      setSavedNote('Не удалось выполнить сброс: сервер недоступен.');
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    setTesting(true);
    setTest(null);
    try {
      const res = await fetch('/api/admin/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl,
          model,
          ...(apiKeyInput.trim() ? { apiKey: apiKeyInput.trim() } : {}),
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; ms?: number; model?: string; tokensIn?: number; tokensOut?: number; error?: string }
        | null;
      if (!data) {
        setTest({ ok: false, text: 'Пустой ответ сервера.' });
      } else if (data.ok) {
        setTest({
          ok: true,
          text: `OK · модель ответила за ${data.ms ?? 0}ms · tokens: ${data.tokensIn ?? 0}/${data.tokensOut ?? 0}`,
        });
      } else {
        setTest({ ok: false, text: data.error ?? 'Неизвестная ошибка.' });
      }
    } catch {
      setTest({ ok: false, text: 'Сервер недоступен.' });
    } finally {
      setTesting(false);
    }
  }

  async function loadModels() {
    setModelsLoading(true);
    setModelsError(null);
    try {
      const res = await fetch('/api/admin/ai/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl, ...(apiKeyInput.trim() ? { apiKey: apiKeyInput.trim() } : {}) }),
      });
      const data = (await res.json().catch(() => null)) as { models?: string[]; error?: string } | null;
      if (!res.ok || !data || !Array.isArray(data.models)) {
        setModelsError(data?.error ?? `Ошибка (${res.status})`);
        return;
      }
      setModels(data.models);
    } catch {
      setModelsError('Не удалось получить список моделей.');
    } finally {
      setModelsLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-sm text-muted">Загрузка настроек</div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-h2 font-bold">Настройки AI</h1>
          <p className="text-sm text-muted mt-1">Подключение локальной модели и ограничения</p>
        </div>
        <nav className="flex flex-wrap gap-1 text-sm">
          <Link href="/admin/ai/settings" className="btn-secondary">Настройки</Link>
          <Link href="/admin/ai/prompts" className="btn-ghost">Промты</Link>
          <Link href="/admin/ai/usage" className="btn-ghost">Статистика</Link>
          <Link href="/admin/ai/logs" className="btn-ghost">Логи</Link>
        </nav>
      </div>

      {loadError ? <p className="text-sm text-danger mb-4">{loadError}</p> : null}

      <div className="card p-5 space-y-5">
        <div>
          <label className="label" htmlFor="ai-preset">Пресет провайдера</label>
          <select
            id="ai-preset"
            className="input"
            value={preset}
            onChange={(e) => {
              const id = e.target.value;
              setPreset(id);
              const found = PRESETS.find((p) => p.id === id);
              if (found?.baseUrl) setBaseUrl(found.baseUrl);
            }}
          >
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="ai-base-url">Base URL</label>
          <input
            id="ai-base-url"
            className="input font-mono"
            value={baseUrl}
            onChange={(e) => {
              setBaseUrl(e.target.value);
              setPreset(presetFor(e.target.value));
            }}
            placeholder="http://localhost:1234/v1"
          />
        </div>

        <div>
          <label className="label" htmlFor="ai-key">API Key</label>
          <div className="flex gap-2">
            <input
              id="ai-key"
              type={showKey ? 'text' : 'password'}
              className="input font-mono"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder={hasApiKey ? (apiKeyMasked ?? 'ключ задан') : 'не задан'}
              autoComplete="off"
            />
            <button
              type="button"
              className="btn-secondary shrink-0"
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? 'Скрыть значение' : 'Показать значение'}
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-1.5">
            <p className="text-xs text-muted">
              {hasApiKey ? `Текущий ключ: ${apiKeyMasked ?? 'задан'}` : 'Ключ не задан'}
            </p>
            <label className="flex items-center gap-1.5 text-xs text-muted">
              <input type="checkbox" checked={clearKey} onChange={(e) => setClearKey(e.target.checked)} />
              Удалить сохранённый ключ
            </label>
            <p className="text-xs text-muted">Пустое поле при сохранении не меняет ключ</p>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="ai-model">Модель</label>
          <div className="flex gap-2">
            <input
              id="ai-model"
              list="ai-model-list"
              className="input font-mono"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="google/gemma-4-12b-qat"
            />
            <datalist id="ai-model-list">
              {models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <button
              type="button"
              className="btn-secondary shrink-0"
              onClick={() => void loadModels()}
              disabled={modelsLoading}
            >
              <RefreshCw size={14} className={modelsLoading ? 'animate-spin' : undefined} />
              Загрузить список
            </button>
          </div>
          {modelsError ? <p className="text-xs text-danger mt-1">{modelsError}</p> : null}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="ai-temp">
              Temperature: <span className="font-mono text-ink">{temperature.toFixed(1)}</span>
            </label>
            <input
              id="ai-temp"
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="w-full accent-[rgb(var(--c-primary))]"
            />
          </div>
          <div>
            <label className="label" htmlFor="ai-max-tokens">Max tokens</label>
            <input
              id="ai-max-tokens"
              type="number"
              min={64}
              max={200000}
              className="input font-mono"
              value={maxTokens}
              onChange={(e) => setMaxTokens(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label" htmlFor="ai-timeout">Таймаут, секунд</label>
            <input
              id="ai-timeout"
              type="number"
              min={1}
              max={600}
              className="input font-mono"
              value={timeoutSec}
              onChange={(e) => setTimeoutSec(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label" htmlFor="ai-rl-user">Лимит запросов в час, авторизованные</label>
            <input
              id="ai-rl-user"
              type="number"
              min={1}
              max={10000}
              className="input font-mono"
              value={rateLimitUser}
              onChange={(e) => setRateLimitUser(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label" htmlFor="ai-rl-anon">Лимит запросов в час, гости</label>
            <input
              id="ai-rl-anon"
              type="number"
              min={1}
              max={10000}
              className="input font-mono"
              value={rateLimitAnon}
              onChange={(e) => setRateLimitAnon(Number(e.target.value))}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="ai-system">Системный промт (дополнение к шаблонам)</label>
          <textarea
            id="ai-system"
            className="input min-h-[96px] resize-y"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Необязательно"
          />
        </div>

        <div>
          <span className="label">Языки перевода</span>
          <div className="flex flex-wrap gap-1.5">
            {Array.from(new Set([...LANG_CHOICES, ...languages])).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => toggleLang(code)}
                className={
                  languages.includes(code)
                    ? 'badge !border-primary/60 !text-primary font-mono'
                    : 'badge font-mono'
                }
              >
                {code}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <input
              className="input font-mono !w-40"
              value={newLang}
              onChange={(e) => setNewLang(e.target.value)}
              placeholder="код языка"
              aria-label="Новый код языка"
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                const code = newLang.trim().toLowerCase();
                if (!code) return;
                setLanguages((prev) => (prev.includes(code) ? prev : [...prev, code]));
                setNewLang('');
              }}
            >
              Добавить
            </button>
          </div>
        </div>

        <div>
          <span className="label">Функции</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {FEATURE_LABELS.map((f) => (
              <label key={f.key} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={features.includes(f.key)}
                  onChange={() => toggleFeature(f.key)}
                />
                {f.label}
                <span className="text-xs text-muted font-mono">{f.key}</span>
              </label>
            ))}
          </div>
          {extraFeatures.length ? (
            <p className="text-xs text-muted mt-2">
              Дополнительные фичи сохраняются как есть: {extraFeatures.join(', ')}
            </p>
          ) : null}
        </div>

        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={logEnabled} onChange={(e) => setLogEnabled(e.target.checked)} />
          Вести логи обращений
        </label>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-line">
          <button type="button" className="btn-primary" onClick={() => void save()} disabled={saving}>
            {saving ? 'Сохраняем' : 'Сохранить'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => void resetToEnv()} disabled={saving}>
            Сбросить к env
          </button>
          <button type="button" className="btn-secondary" onClick={() => void runTest()} disabled={testing}>
            <RefreshCw size={14} className={testing ? 'animate-spin' : undefined} />
            Протестировать подключение
          </button>
          {savedNote ? <span className="text-sm text-muted">{savedNote}</span> : null}
        </div>

        {test ? (
          <p className={test.ok ? 'text-sm text-ok font-mono' : 'text-sm text-danger'}>
            {test.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}
