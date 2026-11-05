import { validateEnv } from './env.validation.js';

const base = {
  DATABASE_URL: 'mysql://u:p@localhost:3306/db',
  CORS_ORIGINS: 'http://localhost:5180',
  APP_URL: 'http://localhost:5180',
  JWT_ACCESS_SECRET: 'a'.repeat(64),
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  MAIL_FROM: 'Access Manager <no-reply@example.test>',
};

describe('validateEnv', () => {
  it('converts strings and applies the documented defaults', () => {
    const env = validateEnv({ ...base, COOKIE_SECURE: 'false', SWAGGER_ENABLED: 'false', SMTP_REQUIRE_TLS: 'true' });
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      SMTP_PORT: 1025,
      COOKIE_SECURE: false,
      LOGIN_MAX_ATTEMPTS: 5,
      LOGIN_ACCOUNT_MAX_ATTEMPTS: 50,
      TRUST_PROXY: 'false',
      SWAGGER_ENABLED: false,
      SMTP_REQUIRE_TLS: true,
      SMTP_SECURE: false,
    });
  });

  it.each([
    ['the .env.example placeholder', 'change-me-generate-with-openssl-rand-hex-32'],
    ['a secret shorter than 256 bits', 'short-secret-0123456789abcdef'],
  ])('refuses to start with %s as JWT secret', (_label, secret) => {
    expect(() => validateEnv({ ...base, JWT_ACCESS_SECRET: secret })).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('lists every missing variable at once', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL[\s\S]*JWT_ACCESS_SECRET[\s\S]*SMTP_HOST/);
  });
});
