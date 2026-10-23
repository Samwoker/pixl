import { createHash, randomBytes } from 'node:crypto';

/** Opaque bearer token for guest accounts until Cognito lands; only the hash is stored. */
export function createToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer ([A-Za-z0-9_-]{20,200})$/.exec(header);
  return match?.[1] ?? null;
}
