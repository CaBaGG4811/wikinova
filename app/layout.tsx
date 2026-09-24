import type { Metadata } from 'next';
import './globals.css';

// Заменяем внешние шрифты на системные стеки для стабильной сборки
const display = {
  variable: '--font-display',
  className: 'font-display',
  style: { fontFamily: '"Arial Black", "Helvetica Neue", sans-serif' },
};

const body = {
  variable: '--font-body',
  className: 'font-serif',
  style: { fontFamily: 'Georgia, "Times New Roman", serif' },
};

const mono = {
  variable: '--font-mono',
  className: 'font-mono',
  style: { fontFamily: 'Consolas, "Courier New", monospace' },
};

export const metadata: Metadata = {
  title: { default: 'WikiNova — локальная энциклопедия', template: '%s · WikiNova' },
  description: 'Современная локальная энциклопедия: статьи, категории, AI-ассистент.',
  icons: { icon: [{ url: '/logo.png', type: 'image/png' }] },
};

const themeScript = `(function(){try{var t=localStorage.getItem('wn-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${display.variable} ${body.variable} ${mono.variable}`}>
        {children}
      </body>
    </html>
  );
}