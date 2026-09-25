'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
    if (password !== confirm) {
      setError('Пароли не совпадают.');
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
      const signInRes = await signIn('credentials', { email: email.trim(), password, redirect: false });
      if (signInRes?.error) {
        setError('Аккаунт создан, но вход не удался. Попробуйте на странице входа.');
        return;
      }
      router.push('/');
      router.refresh();
    } catch {
      setError('Сервер недоступен. Попробуйте позже.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card grid w-full max-w-4xl overflow-hidden shadow-float lg:grid-cols-2">
      <aside className="hidden lg:flex flex-col justify-between bg-[#171412] p-12 text-[#F5F5F4]">
        <div>
          <p className="font-display text-3xl font-bold tracking-tight text-[#4ADE80]">WikiNova</p>
          <p className="mt-6 max-w-[36ch] text-body leading-relaxed text-[#F5F5F4]/85">
            Заведите аккаунт читателя: лайки, закладки, личные коллекции и заявки на новые
            статьи. Статьи лежат на вашем сервере, без внешних сервисов и рекламы.
          </p>
        </div>
        <blockquote className="max-w-[34ch] border-l-2 border-[#4ADE80]/50 pl-4 text-caption italic leading-relaxed text-[#F5F5F4]/70">
          «Энциклопедия растёт из уточнений: каждая правка оставляет след в истории версий.»
        </blockquote>
      </aside>

      <div className="flex items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-md">
          <div className="mb-4 flex justify-end">
            <Link
              href="/login"
              className="text-sm text-muted transition-colors duration-150 hover:text-ink"
            >
              Уже есть аккаунт? Войти →
            </Link>
          </div>

          <div className="card rounded-lg border border-line p-6">
            <h1 className="font-display text-h3 font-bold mb-1">Регистрация</h1>
            <p className="text-sm text-muted mb-6">Аккаунт читателя WikiNova</p>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label" htmlFor="reg-name">Имя</label>
                <input
                  id="reg-name"
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ваше имя"
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="label" htmlFor="reg-email">Email</label>
                <input
                  id="reg-email"
                  className="input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="label" htmlFor="reg-password">Пароль</label>
                <input
                  id="reg-password"
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Минимум 8 символов"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="label" htmlFor="reg-confirm">Повторите пароль</label>
                <input
                  id="reg-confirm"
                  className="input"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Ещё раз"
                  autoComplete="new-password"
                />
              </div>

              {error ? <p className="text-sm text-danger">{error}</p> : null}

              <button type="submit" className="btn-primary w-full" disabled={busy}>
                {busy ? 'Создаём аккаунт' : 'Зарегистрироваться'}
              </button>
            </form>

            <p className="text-sm text-muted mt-5 text-center">
              Уже есть аккаунт?{' '}
              <Link href="/login" className="text-primary underline underline-offset-2">
                Войти
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
