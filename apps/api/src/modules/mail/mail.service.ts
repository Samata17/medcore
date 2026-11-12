import { Global, Injectable, Logger, Module } from "@nestjs/common";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../../config/env";

/**
 * Sends email through SMTP when configured.
 * Development fallback (no SMTP_HOST): the message is printed to the API
 * console so you can copy OTP codes. Production refuses to start without SMTP
 * (see config/env.ts), so codes are never only logged in production.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger("Mail");
  private transporter: Transporter | null = null;

  constructor() {
    const e = env();
    if (e.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: e.SMTP_HOST,
        port: e.SMTP_PORT,
        secure: e.SMTP_PORT === 465,
        auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASS } : undefined,
      });
    }
  }

  async send(to: string, subject: string, text: string) {
    if (!this.transporter) {
      this.logger.warn(`[DEV EMAIL — not sent, SMTP not configured]\n  To: ${to}\n  Subject: ${subject}\n  ${text.replace(/\n/g, "\n  ")}`);
      return;
    }
    await this.transporter.sendMail({ from: env().SMTP_FROM, to, subject, text });
  }
}

@Global()
@Module({ providers: [MailService], exports: [MailService] })
export class MailModule {}
