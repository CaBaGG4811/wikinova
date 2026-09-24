import { db } from '@/lib/db';
import { decryptSecret, encryptSecret, maskKey } from '@/lib/crypto';
import type { AiSettingsPublic } from '@/types';

export interface AiRuntimeSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  systemPrompt: string;
  languages: string[];
  features: string[];
  rateLimitUser: number;
  rateLimitAnon: number;
  logEnabled: boolean;
}

function parseList(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function toNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

const MIN_MAX_TOKENS = 6144;

function clampMaxTokens(value: number): number {
  return Math.max(value, MIN_MAX_TOKENS);
}

export function normalizeBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
}

export function envAiSettings(): AiRuntimeSettings {
  return {
    baseUrl: process.env.AI_BASE_URL || 'http://localhost:1234/v1',
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || 'google/gemma-4-12b-qat',
    temperature: toNumber(process.env.AI_TEMPERATURE, 0.7),
    maxTokens: clampMaxTokens(toNumber(process.env.AI_MAX_TOKENS, 4096)),
    timeoutMs: toNumber(process.env.AI_TIMEOUT_MS, 60000),
    systemPrompt: '',
    languages: ['ru', 'en', 'de', 'fr', 'es', 'zh'],
    features: ['summary', 'qa_article', 'qa_global', 'draft', 'improve', 'translate', 'factcheck', 'metadata', 'web_search', 'embeddings'],
    rateLimitUser: 30,
    rateLimitAnon: 10,
    logEnabled: true,
  };
}

export function envAiSettingsRow(): {
  baseUrl: string;
  apiKeyEncrypted: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
} {
  const env = envAiSettings();
  return {
    baseUrl: env.baseUrl,
    apiKeyEncrypted: env.apiKey ? encryptSecret(env.apiKey) : '',
    model: env.model,
    temperature: env.temperature,
    maxTokens: env.maxTokens,
    timeoutMs: env.timeoutMs,
  };
}

export async function getAISettings(): Promise<AiRuntimeSettings> {
  const fallback = envAiSettings();
  let row: Awaited<ReturnType<typeof db.aISettings.findFirst>>;
  try {
    row = await db.aISettings.findFirst({ orderBy: { id: 'asc' } });
  } catch {
    return fallback;
  }
  if (!row) return { ...fallback, baseUrl: normalizeBaseUrl(fallback.baseUrl) || fallback.baseUrl };
  return {
    baseUrl: normalizeBaseUrl(row.baseUrl || fallback.baseUrl) || fallback.baseUrl,
    apiKey: row.apiKeyEncrypted ? decryptSecret(row.apiKeyEncrypted) : fallback.apiKey,
    model: row.model || fallback.model,
    temperature: toNumber(row.temperature, fallback.temperature),
    maxTokens: clampMaxTokens(toNumber(row.maxTokens, fallback.maxTokens)),
    timeoutMs: toNumber(row.timeoutMs, fallback.timeoutMs),
    systemPrompt: row.systemPrompt || '',
    languages: parseList(row.languages).length ? parseList(row.languages) : fallback.languages,
    features: parseList(row.featuresEnabled).length ? parseList(row.featuresEnabled) : fallback.features,
    rateLimitUser: toNumber(row.rateLimitUser, fallback.rateLimitUser),
    rateLimitAnon: toNumber(row.rateLimitAnon, fallback.rateLimitAnon),
    logEnabled: row.logEnabled,
  };
}

export type AiSettingsAdmin = AiSettingsPublic & {
  systemPrompt: string;
  logEnabled: boolean;
};

export async function getPublicAiSettings(settings?: AiRuntimeSettings): Promise<AiSettingsPublic> {
  const s = settings ?? (await getAISettings());
  return {
    baseUrl: normalizeBaseUrl(s.baseUrl) || s.baseUrl,
    model: s.model,
    temperature: s.temperature,
    maxTokens: s.maxTokens,
    timeoutMs: s.timeoutMs,
    languages: s.languages,
    features: s.features,
    rateLimitUser: s.rateLimitUser,
    rateLimitAnon: s.rateLimitAnon,
    hasApiKey: Boolean(s.apiKey),
    apiKeyMasked: maskKey(s.apiKey),
  };
}

export async function getAdminAiSettings(): Promise<AiSettingsAdmin> {
  const s = await getAISettings();
  return {
    ...(await getPublicAiSettings(s)),
    systemPrompt: s.systemPrompt,
    logEnabled: s.logEnabled,
  };
}
