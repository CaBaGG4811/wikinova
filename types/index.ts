import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: Role;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
  interface User {
    role?: Role;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: Role;
    uid?: string;
  }
}

export type Role = 'USER' | 'EDITOR' | 'ADMIN';

export type ArticleStatus = 'draft' | 'published' | 'archived';

export type RequestStatus = 'pending' | 'in_progress' | 'done' | 'rejected';

export interface ArticleCard {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImage: string | null;
  status: ArticleStatus;
  views: number;
  readingTime: number;
  featured: boolean;
  publishedAt: string | null;
  createdAt: string;
  author: { id: string; name: string };
  category: { slug: string; name: string; color: string } | null;
  tags: { tag: { slug: string; name: string } }[];
  _count?: { likes: number };
}

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

export interface AiSettingsPublic {
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  languages: string[];
  features: string[];
  rateLimitUser: number;
  rateLimitAnon: number;
  hasApiKey: boolean;
  apiKeyMasked: string | null;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface RagSource {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
}

export interface FactCheckItem {
  claim: string;
  verdict: 'confirmed' | 'not_found' | 'conflict';
  sourceSlug?: string;
  sourceTitle?: string;
  note?: string;
}
