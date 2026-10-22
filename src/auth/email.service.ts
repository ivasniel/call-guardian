
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  constructor(private readonly config: ConfigService) {}

  async sendVerification(
    email: string,
    token: string,
  ): Promise<void> {
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const password = this.config.get<string>('SMTP_PASSWORD');
    const from = this.config.get<string>('SMTP_FROM');
    const port = Number(this.config.get('SMTP_PORT') || 587);

    if (!host || !user || !password || !from) {
      throw new ServiceUnavailableException(
        'Email delivery is not configured',
      );
    }

    const frontendUrl = (
      this.config.get<string>('FRONTEND_URL') ||
      'http://localhost:4200'
    ).replace(/\/$/, '');

    const verificationUrl =
      `${frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      auth: { user, pass: password },
    });

    await transporter.sendMail({
      from,
      to: email,
      subject: 'Verify your Call Guardian AI email',
      text:
        `Welcome to Call Guardian AI.\n\n` +
        `Verify your email address using this link:\n` +
        `${verificationUrl}\n\n` +
        `This link expires in 30 minutes.\n` +
        `If you did not request this, ignore this email.`,
    });
  }
}
