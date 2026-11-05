import { generateOpaqueToken, hashOpaqueToken } from './opaque-token.js';

describe('opaque tokens', () => {
  it('generates 256-bit URL-safe tokens that never repeat', () => {
    const tokens = new Set(Array.from({ length: 1000 }, generateOpaqueToken));
    expect(tokens.size).toBe(1000);
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('stores a deterministic SHA-256 that differs from the token', () => {
    const token = generateOpaqueToken();
    expect(hashOpaqueToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashOpaqueToken(token)).toBe(hashOpaqueToken(token));
    expect(hashOpaqueToken(token)).not.toContain(token);
  });
});
