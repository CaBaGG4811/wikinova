import type { Metadata } from 'next';
import { Unbounded, Source_Serif_4, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const display = Unbounded({ subsets: ['latin', 'cyrillic'], variable: '--font-display', weight: ['500', '700'], display: 'swap' });
const body = Source_Serif_4({ subsets: ['latin', 'cyrillic'], variable: '--font-body', style: ['normal', 'italic'], weight: ['400', '600'] });
const mono = JetBrains_Mono({ subsets: ['latin', 'cyrillic'], variable: '--font-mono', weight: ['400', '500'] });

export const metadata: Metadata = {
  title: { default: 'WikiNova', template: '%s · WikiNova' },
  description: 'Современная локальная энциклопедия: статьи, категории, AI-ассистент.',
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