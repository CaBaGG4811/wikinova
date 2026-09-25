'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { X } from 'lucide-react';

type AuthMode = 'login' | 'register';

interface AuthModalValue {
  open: (mode?: AuthMode) => void;
  close: () => void;
}

const AuthModalContext = createContext<AuthModalValue>({
  open: () => {},
  close: () => {},
});

export function useAuthModal() {
  return useContext(AuthModalContext);
}

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<AuthMode>('login');

  const open = useCallback((next: AuthMode = 'login') => {
    setMode(next);
    setVisible(true);
  }, []);

  const close = useCallback(() => setVisible(false), []);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVisible(false);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [visible]);

  const value = useMemo(() => ({ open, close }), [open, close]);

  return (
    <AuthModalContext.Provider value={value}>
      {children}
      {visible ? <AuthModal mode={mode} setMode={setMode} onClose={close} /> : null}
    </AuthModalContext.Provider>
  );
}

function GoogleGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function AuthModal({
  mode,
  setMode,
  onClose,
}: {
  mode: AuthMode;
  setMode: (m: AuthMode) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function finish() {
    const from = new URLSearchParams(window.location.search).get('from');
    onClose();
    if (from && from.startsWith('/')) {
      router.push(from);
    } else {
      window.history.replaceState(null, '', window.location.pathname);
    }
    router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (mode === 'register') {
      if (name.trim().length < 2) {
        setError('Имя должно содержать минимум 2 символа.');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setError('Введите корректный email.');
        return;
      }
      if (password.length < 8) {
        setError('Пароль должен содержать минимум 8 символов.');
        return;
      }
      setBusy(true);
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), password, name: name.trim() }),
        });
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) {
          setError(data?.error ?? `Ошибка регистрации (${res.status}).`);
          return;
        }
        const s = await signIn('credentials', { email: email.trim(), password, redirect: false });
        if (s?.error) {
          setError('Аккаунт создан, но вход не удался. Попробуйте войти.');
          setMode('login');
          return;
        }
      } catch {
        setError('Сервер недоступен. Попробуйте позже.');
        return;
      } finally {
        setBusy(false);
      }
      finish();
      return;
    }

    setBusy(true);
    try {
      const s = await signIn('credentials', { email: email.trim(), password, redirect: false });
      if (s?.error) {
        setError('Неверный email или пароль.');
        return;
      }
    } catch {
      setError('Сервер недоступен. Попробуйте позже.');
      return;
    } finally {
      setBusy(false);
    }
    finish();
  }

  function socialNotice(provider: string) {
    setNotice(`${provider}: вход подключим позже, пока войдите по email.`);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Закрыть"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'login' ? 'Вход в WikiNova' : 'Регистрация в WikiNova'}
        className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          <X size={18} />
        </button>

        <h2 className="font-display text-xl font-extrabold tracking-tight text-gray-900">
          {mode === 'login' ? 'Вход в WikiNova' : 'Регистрация в WikiNova'}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {mode === 'login'
            ? 'Продолжайте читать, собирать коллекции и задавать вопросы.'
            : 'Заведите аккаунт читателя за минуту.'}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          {mode === 'register' ? (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="auth-name">
                Имя
              </label>
              <input
                id="auth-name"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-gray-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ваше имя"
                autoComplete="name"
              />
            </div>
          ) : null}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="auth-email">
              Email
            </label>
            <input
              id="auth-email"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-gray-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="auth-password">
              Пароль
            </label>
            <input
              id="auth-password"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-gray-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'Минимум 8 символов' : 'Ваш пароль'}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:from-green-700 hover:to-emerald-700 disabled:opacity-60"
          >
            {busy ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-gray-400">
          <span className="h-px flex-1 bg-gray-200" />
          или
          <span className="h-px flex-1 bg-gray-200" />
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => socialNotice('Google')}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            <GoogleGlyph />
            Продолжить с Google
          </button>
          <button
            type="button"
            onClick={() => socialNotice('Яндекс ID')}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            <span className="flex h-[18px] w-[18px] items-center justify-center rounded bg-[#FC3F1D] text-[11px] font-bold leading-none text-white">
              Я
            </span>
            Войти с Яндекс ID
          </button>
          <button
            type="button"
            onClick={() => socialNotice('VK')}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#0077FF] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0066DD]"
          >
            <span className="text-[13px] font-extrabold tracking-tight">VK</span>
            Войти через VK
          </button>
        </div>

        {notice ? <p className="mt-3 text-center text-xs text-gray-500">{notice}</p> : null}

        <p className="mt-5 text-center text-sm text-gray-500">
          {mode === 'login' ? 'Нет аккаунта? ' : 'Уже есть аккаунт? '}
          <button
            type="button"
            onClick={() => {
              setError(null);
              setNotice(null);
              setMode(mode === 'login' ? 'register' : 'login');
            }}
            className="font-semibold text-violet-600 underline underline-offset-2 hover:text-violet-700"
          >
            {mode === 'login' ? 'Зарегистрироваться' : 'Войти'}
          </button>
        </p>
      </div>
    </div>
  );
}
