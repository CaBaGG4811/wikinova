export const designTokens = {
  color: {
    bg: '#FBFAF8',
    surface: '#FFFFFF',
    ink: '#1C1917',
    muted: '#57534E',
    line: '#E7E5E4',
    primary: '#166534',
    primarySoft: '#DCFCE7',
    primaryFg: '#FFFFFF',
    accent: '#C2410C',
    danger: '#B91C1C',
    ok: '#15803D',
    darkBg: '#171412',
    darkInk: '#F5F5F4',
    darkPrimary: '#4ADE80',
    darkAccent: '#FB923C',
  },
  font: {
    display: 'Unbounded',
    body: 'Source Serif 4',
    mono: 'JetBrains Mono',
  },
  radius: { sharp: 4, control: 6, card: 8, container: 12, pill: 9999 },
  shadow: {
    rest: 'none',
    raise: '0 1px 2px rgb(28 25 23 / 0.06), 0 6px 16px -8px rgb(28 25 23 / 0.12)',
    float: '0 8px 30px -6px rgb(28 25 23 / 0.18)',
  },
  motion: { micro: 170, orchestrated: 360, staggerMs: 60 },
  readingColumn: '68ch',
} as const;

export type DesignTokens = typeof designTokens;
