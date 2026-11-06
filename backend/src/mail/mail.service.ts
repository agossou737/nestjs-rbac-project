import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly resetTtlMinutes: number;

  constructor(config: ConfigService) {
    this.from = config.getOrThrow<string>('MAIL_FROM');
    this.resetTtlMinutes = config.getOrThrow<number>('PASSWORD_RESET_TTL_MINUTES');
    this.transporter = createTransport({
      host: config.getOrThrow<string>('SMTP_HOST'),
      port: config.getOrThrow<number>('SMTP_PORT'),
      secure: config.getOrThrow<boolean>('SMTP_SECURE'),
      requireTLS: config.getOrThrow<boolean>('SMTP_REQUIRE_TLS'),
      connectionTimeout: 5_000,
      greetingTimeout: 5_000,
      socketTimeout: 10_000,
    });
  }

  async sendInvitation(to: string, details: { firstName: string; resetUrl: string; roles: string[] }): Promise<void> {
    const roles = details.roles.length > 0 ? details.roles.map((role) => `  - ${role}`) : ['  Aucun rôle pour le moment : un administrateur vous en attribuera.'];
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Votre compte Access Manager a été créé',
      text: [
        `Bonjour ${details.firstName},`,
        '',
        'Un compte Access Manager vient d’être créé pour vous. Vos rôles :',
        ...roles,
        '',
        `Pour l'activer, choisissez votre mot de passe : ${details.resetUrl}`,
        '',
        `Le lien est valable ${this.resetTtlMinutes} minutes et ne fonctionne qu'une fois. S'il a expiré, utilisez « Mot de passe oublié » sur la page de connexion.`,
      ].join('\n'),
    });
  }

  async sendPasswordReset(to: string, resetUrl: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Réinitialisation de votre mot de passe Access Manager',
      text: [
        'Bonjour,',
        '',
        'Une réinitialisation du mot de passe de votre compte Access Manager a été demandée.',
        `Ouvrez ce lien pour choisir un nouveau mot de passe : ${resetUrl}`,
        '',
        `Le lien est valable ${this.resetTtlMinutes} minutes et ne fonctionne qu'une fois. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe actuel reste valable.`,
      ].join('\n'),
    });
  }
}
