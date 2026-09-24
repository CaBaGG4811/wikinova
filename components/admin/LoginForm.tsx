'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';

export function LoginForm({ from }: { from: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await signIn('credentials', { email, password, redirect: false });
      if (res?.error) {
        setError('Неверный email или пароль.');
        return;
      }
      router.replace(from);
      router.refresh();
    } catch {
      setError('Не удалось войти. Проверьте соединение и повторите.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Link href="/" className="font-display font-bold text-2xl tracking-tight">
            Wiki<span className="text-primary">Nova</span>
          </Link>
          <p className="mt-1.5 text-sm text-muted">Вход в панель редактора</p>
        </div>
        <form onSubmit={handleSubmit} className="card p-5 space-y-4">
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@wikinova.local"
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Входим...' : 'Войти'}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-muted">
          <Link href="/" className="hover:text-ink">
            Вернуться на сайт
          </Link>
        </p>
      </div>
    </div>
  );
}
