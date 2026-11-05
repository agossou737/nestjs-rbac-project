import { createHash, randomBytes } from 'node:crypto';

// Refresh and reset tokens are random secrets; only their SHA-256 is stored, so a database leak yields no usable token.
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
