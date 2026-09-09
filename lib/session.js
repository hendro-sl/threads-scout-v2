import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

function keyFromSecret(secret) {
  return createHash('sha256').update(String(secret)).digest();
}

export function encryptSession(payload, secret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFromSecret(secret), iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv, tag, encrypted]
    .map((part) => part.toString('base64url'))
    .join('.');
}

export function decryptSession(value, secret) {
  try {
    if (!value || !secret) return null;
    const [ivPart, tagPart, encryptedPart] = value.split('.');
    if (!ivPart || !tagPart || !encryptedPart) return null;

    const iv = Buffer.from(ivPart, 'base64url');
    const tag = Buffer.from(tagPart, 'base64url');
    const encrypted = Buffer.from(encryptedPart, 'base64url');

    const decipher = createDecipheriv(
      'aes-256-gcm',
      keyFromSecret(secret),
      iv
    );
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');

    const payload = JSON.parse(decrypted);
    if (payload?.expiresAt && Date.now() >= payload.expiresAt) return null;
    return payload;
  } catch {
    return null;
  }
}
