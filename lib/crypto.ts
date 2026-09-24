import crypto from 'crypto';

const KEY = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');

function getKey(): Buffer {
  if (KEY.length === 32) return KEY;
  return crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY || 'wikinova-default').digest();
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.');
}

export function decryptSecret(payload: string): string {
  if (!payload) return '';
  try {
    const [ivB, tagB, dataB] = payload.split('.');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(dataB, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

export function maskKey(key: string): string | null {
  if (!key) return null;
  if (key.length <= 8) return `${key.slice(0, 2)}…`;
  return `${key.slice(0, 5)}…${key.slice(-3)}`;
}
