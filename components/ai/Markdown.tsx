'use client';

import { useRef, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import Link from 'next/link';
import { Check, Copy } from 'lucide-react';
import 'katex/dist/katex.min.css';

function isInternal(href: string): boolean {
  return href.startsWith('/') || href.startsWith('#');
}

function CodeBlock({ children }: { children?: ReactNode }) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative my-4 group">
      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
        <button
          type="button"
          className="btn-ghost !px-2 !py-1 text-xs"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(preRef.current?.textContent ?? '');
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Скопировано' : 'Копировать'}
        </button>
      </div>
      <pre
        ref={preRef}
        className="rounded-sm bg-ink/95 text-stone-100 p-4 overflow-x-auto text-[0.9rem]"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {children}
      </pre>
    </div>
  );
}

const markdownComponents = {
  a(props: { href?: string; children?: ReactNode }) {
    const href = props.href ?? '';
    if (isInternal(href)) {
      return <Link href={href}>{props.children}</Link>;
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {props.children}
      </a>
    );
  },
  pre(props: { children?: ReactNode }) {
    return <CodeBlock>{props.children}</CodeBlock>;
  },
  code(props: { className?: string; children?: ReactNode }) {
    const isBlock = Boolean(props.className);
    if (isBlock) {
      return <code className={props.className}>{props.children}</code>;
    }
    return (
      <code className="bg-ink/8 rounded-sm px-1.5 py-0.5 text-[0.9em]">{props.children}</code>
    );
  },
};

export function Markdown({ children }: { children: string }) {
  if (!children) return null;
  return (
    <div className="prose-wiki">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} components={markdownComponents}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
