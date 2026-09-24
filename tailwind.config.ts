import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--c-bg) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        primary: {
          DEFAULT: 'rgb(var(--c-primary) / <alpha-value>)',
          fg: 'rgb(var(--c-primary-fg) / <alpha-value>)',
          soft: 'rgb(var(--c-primary-soft) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--c-accent) / <alpha-value>)',
          fg: 'rgb(var(--c-accent-fg) / <alpha-value>)',
        },
        danger: 'rgb(var(--c-danger) / <alpha-value>)',
        ok: 'rgb(var(--c-ok) / <alpha-value>)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        serif: ['var(--font-body)', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      fontSize: {
        hero: ['2.625rem', { lineHeight: '1.08', letterSpacing: '-0.03em' }],
        h2: ['1.875rem', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        h3: ['1.375rem', { lineHeight: '1.25', letterSpacing: '-0.015em' }],
        body: ['1.0625rem', { lineHeight: '1.75' }],
        caption: ['0.875rem', { lineHeight: '1.5' }],
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px',
      },
      boxShadow: {
        raise: '0 1px 2px rgb(28 25 23 / 0.06), 0 6px 16px -8px rgb(28 25 23 / 0.12)',
        float: '0 8px 30px -6px rgb(28 25 23 / 0.18)',
      },
      keyframes: {
        'stagger-in': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(24px)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
      },
      animation: {
        'stagger-in': 'stagger-in 380ms cubic-bezier(0.22,1,0.36,1) both',
        'slide-in-right': 'slide-in-right 300ms cubic-bezier(0.22,1,0.36,1) both',
      },
    },
  },
  plugins: [],
};

export default config;
