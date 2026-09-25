import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight, BookOpen, Lightbulb, Sparkles } from 'lucide-react';
import { db } from '@/lib/db';
import { cardInclude } from '@/lib/article';
import { ArticleCard } from '@/components/article/ArticleCard';
import { HeroAskInput } from '@/components/home/HeroAskInput';
import { AutoAuth } from '@/components/home/AutoAuth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Главная',
  description:
    'WikiNova — AI-поисковик знаний: спросите что угодно и получите ответ из статей локальной энциклопедии.',
};

const POPULAR_QUESTIONS = [
  'Как работает квантовый компьютер?',
  'История Рима',
  'Биография Пушкина',
  'Что такое нейросеть?',
  'Как устроен фотосинтез?',
];

const DAILY_FACTS = [
  'У Сатурна столько лун, что их открытие продолжается каждый год — на сегодня их больше сотни.',
  'Слово «энциклопедия» пришло из греческого и буквально значит «получение знаний о всём».',
  'Первая версия Википедии запустилась 15 января 2001 года — и сразу на двух языках.',
  'Банан — ягода, а клубника — нет: ботаника определяет плод по строению, а не по вкусу.',
  'Свет от Солнца достигает Земли за 8 минут 20 секунд, но звезде на самом деле больше 4,5 млрд лет.',
  'В человеческом мозге около 86 млрд нейронов — примерно столько же звёзд в Млечном Пути.',
  'Самый короткий вооружённый конфликт в истории длился 38 минут: англо-танзанийская война 1896 года.',
  'Самая древняя работающая библиотека — монастырская коллекция в Сен-Катберн, ей больше 1000 лет.',
  'Миллион русских рублей весит тонну — купюры по 5000 рублей из золота не делают.',
  'Первый веб-сайт в мире появился 6 августа 1991 года и описывал, как устроен сам веб.',
  'Синий кит — самое крупное животное на Земле: его сердце размером с автомобиль.',
  'В Японии есть остров оленей, где животные не боятся людей: их около 1200.',
];

function pickByDay<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  const now = new Date();
  const seed = now.getFullYear() * 372 + now.getMonth() * 31 + now.getDate();
  return items[seed % items.length];
}

export default async function HomePage({
  searchParams,
}: {
  searchParams?: { auth?: string; from?: string };
}) {
  const [dayPool, fresh, collections] = await Promise.all([
    db.article.findMany({
      where: { status: 'published', coverImage: { not: null } },
      include: cardInclude,
      orderBy: { views: 'desc' },
      take: 12,
    }),
    db.article.findMany({
      where: { status: 'published' },
      include: cardInclude,
      orderBy: { publishedAt: 'desc' },
      take: 6,
    }),
    db.collection.findMany({
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: { _count: { select: { items: true } } },
    }),
  ]);

  const dayArticle = pickByDay(dayPool);
  const fact = pickByDay(DAILY_FACTS);

  return (
    <div className="bg-white">
      <AutoAuth mode={searchParams?.auth} />

      <section className="flex min-h-[80vh] flex-col items-center justify-center px-4 pb-16 pt-24 text-center">
        <span className="mb-6 inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
          <Sparkles size={13} />
          AI-поиск знаний
        </span>
        <h1 className="font-display max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
          Что вы хотите узнать?
        </h1>
        <p className="mt-5 max-w-xl text-lg text-gray-500">
          Задайте вопрос — мы найдём ответ в статьях WikiNova и подскажем, с чего начать.
        </p>

        <div className="mt-10 w-full">
          <HeroAskInput />
        </div>

        <div className="mt-6 flex max-w-3xl flex-wrap justify-center gap-2">
          {POPULAR_QUESTIONS.map((question) => (
            <Link
              key={question}
              href={`/search?q=${encodeURIComponent(question)}`}
              className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-600 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
            >
              {question}
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-32 max-w-6xl px-4">
        <div className="grid gap-6 md:grid-cols-3">
          <article className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md duration-300">
            {dayArticle ? (
              <Link
                href={`/article/${dayArticle.slug}`}
                className="relative block aspect-video overflow-hidden bg-gray-100"
              >
                <Image
                  src={dayArticle.coverImage ?? '/logo.png'}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
              </Link>
            ) : (
              <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-green-50 to-violet-50">
                <BookOpen size={36} className="text-green-700" />
              </div>
            )}
            <div className="p-5">
              <span className="text-xs font-semibold uppercase tracking-wide text-violet-600">
                Статья дня
              </span>
              {dayArticle ? (
                <>
                  <h3 className="mt-2 font-display text-lg font-bold leading-snug text-gray-900">
                    <Link href={`/article/${dayArticle.slug}`} className="hover:text-green-700">
                      {dayArticle.title}
                    </Link>
                  </h3>
                  {dayArticle.excerpt ? (
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-gray-500">
                      {dayArticle.excerpt}
                    </p>
                  ) : null}
                  <Link
                    href={`/article/${dayArticle.slug}`}
                    className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-green-700 transition hover:text-green-800"
                  >
                    Читать <ArrowUpRight size={14} />
                  </Link>
                </>
              ) : (
                <p className="mt-2 text-sm text-gray-500">Статьи скоро появятся.</p>
              )}
            </div>
          </article>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-violet-600">
              Факт дня
            </span>
            <div className="mt-3 flex gap-3">
              <Lightbulb size={22} className="mt-0.5 shrink-0 text-violet-600" />
              <p className="text-[15px] leading-relaxed text-gray-700">{fact}</p>
            </div>
            <p className="mt-4 text-xs text-gray-400">Каждый день — новый факт из энциклопедии.</p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-violet-600">
              Новое в коллекциях
            </span>
            {collections.length > 0 ? (
              <ul className="mt-3 space-y-3">
                {collections.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/collection/${c.id}`}
                      className="flex items-start justify-between gap-2 text-sm text-gray-700 transition hover:text-green-700"
                    >
                      <span className="font-medium">{c.name}</span>
                      <span className="shrink-0 text-xs text-gray-400">{c._count.items}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-gray-500">Подборок пока нет — создайте свою.</p>
            )}
            <Link
              href="/collections"
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-green-700 transition hover:text-green-800"
            >
              Все коллекции <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-24 max-w-6xl px-4 pb-4">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="font-display text-h2 font-bold text-gray-900">Свежие статьи</h2>
          <Link
            href="/articles"
            className="text-sm font-medium text-green-700 transition-colors hover:text-green-800"
          >
            Весь каталог
          </Link>
        </div>
        {fresh.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-500">
            Статей пока нет
          </p>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {fresh.map((a, i) => (
              <div key={a.id} className="stagger-item" style={{ animationDelay: `${i * 60}ms` }}>
                <ArticleCard article={a} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
