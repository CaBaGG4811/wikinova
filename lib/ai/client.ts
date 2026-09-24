import OpenAI from 'openai';
import { getAISettings } from '@/lib/ai/settings';

export interface AiClientConfig {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
}

export function createAIClient(config: AiClientConfig): OpenAI {
  return new OpenAI({
    baseURL: config.baseUrl,
    apiKey: config.apiKey || 'no-key',
    timeout: config.timeoutMs,
    maxRetries: 0,
  });
}

export async function getAIClient(): Promise<OpenAI> {
  const s = await getAISettings();
  return createAIClient({ baseUrl: s.baseUrl, apiKey: s.apiKey, timeoutMs: s.timeoutMs });
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

export function pickMessageText(message: unknown): string {
  if (!message || typeof message !== 'object') return '';
  const m = message as Record<string, unknown>;
  const content = typeof m.content === 'string' ? m.content : '';
  if (content) return content;
  const reasoning = typeof m.reasoning_content === 'string' ? m.reasoning_content : '';
  if (reasoning) return reasoning;
  return typeof m.reasoning === 'string' ? m.reasoning : '';
}

export function humanizeAiError(err: unknown): string {
  if (err instanceof OpenAI.APIError) {
    const status = err.status;
    const message = err.message || 'нет подробностей';
    if (status === undefined) {
      if (/timed? ?out|timeout/i.test(message)) {
        return 'Таймаут: модель не ответила за отведённое время. Увеличьте Timeout в настройках AI.';
      }
      if (/fetch|network|econnrefused|enotfound|eai_again|socket/i.test(message)) {
        return 'Локальная модель недоступна. Проверьте Base URL в настройках AI.';
      }
      return `Локальная модель недоступна. Проверьте Base URL в настройках AI. (${message})`;
    }
    if (status === 401 || status === 403) {
      return `Модель отклонила запрос: проблема с API-ключом (${status}).`;
    }
    if (status === 404) {
      return `Модель отклонила запрос: эндпоинт или модель не найдена (404). Проверьте Base URL и имя модели.`;
    }
    if (status === 429) {
      return 'Модель отклонила запрос: превышен лимит провайдера (429).';
    }
    if (status >= 500) {
      return `Локальная модель недоступна. Сервер вернул ${status}.`;
    }
    return `Модель отклонила запрос: ${message}`;
  }
  if (err instanceof Error) {
    if (err.name === 'AbortError') {
      return 'Генерация остановлена.';
    }
    if (/aborted|timed? ?out|timeout/i.test(err.message)) {
      return 'Таймаут: модель не ответила за отведённое время. Увеличьте Timeout в настройках AI.';
    }
    if (/fetch failed|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|network|socket/i.test(err.message)) {
      return 'Локальная модель недоступна. Проверьте Base URL в настройках AI.';
    }
    return err.message;
  }
  return 'Неизвестная ошибка модели.';
}
