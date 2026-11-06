import type { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service.js';

const sendMail = vi.fn().mockResolvedValue({});
const createTransport = vi.fn((_options: unknown) => ({ sendMail }));
vi.mock('nodemailer', () => ({ createTransport: (options: unknown) => createTransport(options) }));

const values: Record<string, unknown> = {
  MAIL_FROM: 'Access Manager <no-reply@example.test>',
  PASSWORD_RESET_TTL_MINUTES: 30,
  SMTP_HOST: 'smtp.internal',
  SMTP_PORT: 587,
  SMTP_SECURE: false,
  SMTP_REQUIRE_TLS: true,
};
const config = { getOrThrow: (key: string) => values[key] } as unknown as ConfigService;

describe('MailService', () => {
  it('opens the SMTP transport with explicit timeouts and the TLS requirement', () => {
    new MailService(config);
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'smtp.internal', port: 587, requireTLS: true, connectionTimeout: 5000, socketTimeout: 10000 }),
    );
  });

  it('sends the reset link with its validity, in French, to the account only', async () => {
    await new MailService(config).sendPasswordReset('awa@example.test', 'https://am.example.test/reset-password?token=abc');
    const message = sendMail.mock.calls.at(-1)![0] as { to: string; from: string; subject: string; text: string };
    expect(message.to).toBe('awa@example.test');
    expect(message.from).toBe(values.MAIL_FROM);
    expect(message.subject).toMatch(/mot de passe/i);
    expect(message.text).toContain('https://am.example.test/reset-password?token=abc');
    expect(message.text).toContain('30 minutes');
  });

  it('lists the roles in the invitation, or says that none is assigned yet', async () => {
    const service = new MailService(config);
    await service.sendInvitation('awa@example.test', { firstName: 'Awa', resetUrl: 'https://am.example.test/reset-password?token=t', roles: ['Editor', 'Viewer'] });
    const withRoles = sendMail.mock.calls.at(-1)![0] as { to: string; subject: string; text: string };
    expect(withRoles.to).toBe('awa@example.test');
    expect(withRoles.subject).toMatch(/compte/i);
    expect(withRoles.text).toContain('Bonjour Awa,');
    expect(withRoles.text).toContain('  - Editor\n  - Viewer');
    expect(withRoles.text).toContain('https://am.example.test/reset-password?token=t');

    await service.sendInvitation('kofi@example.test', { firstName: 'Kofi', resetUrl: 'https://x', roles: [] });
    expect((sendMail.mock.calls.at(-1)![0] as { text: string }).text).toMatch(/aucun rôle/i);
  });
});
