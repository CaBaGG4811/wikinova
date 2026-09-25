import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-bg">
      <Link
        href="/"
        className="absolute left-4 top-4 z-20 inline-flex items-center gap-2 rounded-md border border-line bg-surface/85 px-3 py-2 text-sm font-medium text-ink backdrop-blur transition-all duration-150 hover:border-primary/40 hover:text-primary"
      >
        <ArrowLeft size={15} />
        На главную
      </Link>
      <div className="flex min-h-screen items-center justify-center px-4 py-20 sm:px-6">
        {children}
      </div>
    </div>
  );
}
