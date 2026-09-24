'use client';

import { useEffect, useState } from 'react';

export function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function measure() {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      setProgress(max > 0 ? Math.min(100, (doc.scrollTop / max) * 100) : 0);
    }
    measure();
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, []);

  return (
    <div className="fixed left-0 right-0 top-0 z-50 h-0.5 bg-transparent" aria-hidden="true">
      <div
        className="h-full bg-primary transition-[width] duration-150"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
