interface IconProps {
  size?: number;
  className?: string;
}

function Svg({ size = 22, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 ${className ?? ''}`}
    >
      {children}
    </svg>
  );
}

export function GalileoHomeIcon({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <defs>
        <linearGradient id="gi-home" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4C84BC" />
          <stop offset="1" stopColor="#545CA1" />
        </linearGradient>
      </defs>
      <path
        d="M12 2.4 21.6 10.6a.9.9 0 0 1-.58 1.6H19.4v7.5a1.6 1.6 0 0 1-1.6 1.6h-3.1v-5.9a1.7 1.7 0 0 0-1.7-1.7h-1.9a1.7 1.7 0 0 0-1.7 1.7v5.9H6.2a1.6 1.6 0 0 1-1.6-1.6v-7.5H2.98a.9.9 0 0 1-.57-1.6z"
        fill="url(#gi-home)"
      />
      <path
        d="M10.5 9.4a1.5 1.5 0 0 1 3 0v1.6h-3z"
        fill="#fff"
        opacity=".55"
      />
    </Svg>
  );
}

export function GalileoBookIcon({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <defs>
        <linearGradient id="gi-book" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#545CA1" />
          <stop offset="1" stopColor="#AE8CC0" />
        </linearGradient>
      </defs>
      <path
        d="M11.1 6.5C9.6 5.2 7.6 4.5 5.1 4.5c-.87 0-1.6.7-1.6 1.57v11.2c0 .87.73 1.58 1.6 1.58 2.5 0 4.5.7 6 2.02a.9.9 0 0 0 1 0c1.5-1.32 3.5-2.02 6-2.02.87 0 1.6-.71 1.6-1.58V6.07c0-.87-.73-1.57-1.6-1.57-2.5 0-4.5.7-6 2z"
        fill="url(#gi-book)"
      />
      <path d="M12 8.1v12.6" stroke="#fff" strokeWidth="1.4" opacity=".6" strokeLinecap="round" />
      <path d="M4.9 8.1h3.6M4.9 11h3.6M15.5 8.1h3.6M15.5 11h3.6" stroke="#fff" strokeWidth="1.2" opacity=".5" strokeLinecap="round" />
    </Svg>
  );
}

export function GalileoCollectionsIcon({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <defs>
        <linearGradient id="gi-coll" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#AE8CC0" />
          <stop offset="1" stopColor="#4C84BC" />
        </linearGradient>
      </defs>
      <path d="M12 3.1 21 7.4 12 11.7 3 7.4z" fill="url(#gi-coll)" />
      <path d="M3.4 11.4 12 15.5l8.6-4.1v2.2L12 17.7 3.4 13.6z" fill="url(#gi-coll)" opacity=".72" />
      <path d="M3.4 15.7 12 19.8l8.6-4.1v2.1L12 21.9l-8.6-4.1z" fill="url(#gi-coll)" opacity=".48" />
    </Svg>
  );
}

export function GalileoAssistantIcon({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <defs>
        <linearGradient id="gi-ai" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#545CA1" />
          <stop offset="1" stopColor="#AE8CC0" />
        </linearGradient>
      </defs>
      <path
        d="M11.3 2.6c.66 4 2.28 6 6.3 6.66-4.02.66-5.64 2.66-6.3 6.66-.66-4-2.28-6-6.3-6.66 4.02-.66 5.64-2.66 6.3-6.66z"
        fill="url(#gi-ai)"
      />
      <path
        d="M18.4 14.2c.33 2 1.15 3 3.15 3.32-2 .32-2.82 1.32-3.15 3.32-.33-2-1.15-3-3.15-3.32 2-.32 2.82-1.32 3.15-3.32z"
        fill="url(#gi-ai)"
        opacity=".7"
      />
    </Svg>
  );
}

export function GalileoUserIcon({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <defs>
        <linearGradient id="gi-user" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4C84BC" />
          <stop offset="1" stopColor="#A2BEDC" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="7.8" r="4.1" fill="url(#gi-user)" />
      <path
        d="M4.6 20.1c.62-3.9 3.66-6.1 7.4-6.1s6.78 2.2 7.4 6.1a1 1 0 0 1-.99 1.2H5.59a1 1 0 0 1-.99-1.2z"
        fill="url(#gi-user)"
      />
    </Svg>
  );
}
