'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await signIn('credentials', { email: email.trim(), password, redirect: false });
      if (res?.error) {
        setError('Неверный email или пароль');
        return;
      }
      const from = new URLSearchParams(window.location.search).get('from');
      router.push(from && from.startsWith('/') ? from : '/');
      router.refresh();
    } catch {
      setError('Сервер недоступен. Попробуйте позже.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="card rounded-xl p-6">
        <h1 className="font-display text-h3 font-bold mb-1">Вход</h1>
        <p className="text-sm text-muted mb-6">Войдите в аккаунт читателя</p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="label" htmlFor="login-password">Пароль</label>
            <input
              id="login-password"
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ваш пароль"
              autoComplete="current-password"
            />
          </div>

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? 'Входим' : 'Войти'}
          </button>
        </form>

        <p className="text-sm text-muted mt-5 text-center">
          Нет аккаунта?{' '}
          <Link href="/register" className="text-primary underline underline-offset-2">
            Зарегистрироваться
          </Link>
        </p>
        <p className="text-xs text-muted mt-3 text-center">
          <Link href="/admin/login" className="underline underline-offset-2">
            Войти как администратор
          </Link>
        </p>
      </div>
    </div>
  );
}
