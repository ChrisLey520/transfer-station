import crypto from 'node:crypto';
import { customAlphabet } from 'nanoid';

const tokenAlphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const makeToken = customAlphabet(tokenAlphabet, 42);
const algorithm = 'aes-256-gcm';

function keyEncryptionSecret() {
  return process.env.KEY_ENCRYPTION_SECRET || process.env.ADMIN_TOKEN || 'transfer-station-local-key-secret';
}

function encryptionKey() {
  return crypto.createHash('sha256').update(keyEncryptionSecret()).digest();
}

export function hashKey(key: string) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function createApiKey() {
  return `ccx_${makeToken()}`;
}

export function previewKey(key: string) {
  return `${key.slice(0, 8)}...${key.slice(-6)}`;
}

export function encryptKey(key: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(key, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString('base64url')).join('.');
}

export function decryptKey(ciphertext: string | null | undefined) {
  if (!ciphertext) return null;
  const [ivText, tagText, encryptedText] = ciphertext.split('.');
  if (!ivText || !tagText || !encryptedText) return null;

  try {
    const decipher = crypto.createDecipheriv(algorithm, encryptionKey(), Buffer.from(ivText, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedText, 'base64url')),
      decipher.final()
    ]).toString('utf8');
  } catch {
    return null;
  }
}
