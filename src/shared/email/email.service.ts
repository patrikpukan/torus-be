import { Injectable, Logger } from "@nestjs/common";
import nodemailer, { type Transporter } from "nodemailer";
import { Config } from "../config/config.service";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter | null;
  private readonly defaultFrom: string;

  constructor(private readonly config: Config) {
    this.transporter =
      config.smtpHost && config.smtpUsername && config.smtpPassword
        ? nodemailer.createTransport({
            host: config.smtpHost,
            port: config.smtpPort ?? 587,
            secure: Boolean(config.smtpSecure),
            auth: { user: config.smtpUsername, pass: config.smtpPassword },
          })
        : null;

    const domain = (() => {
      try {
        return new URL(config.baseUrl).hostname;
      } catch {
        return "localhost";
      }
    })();
    this.defaultFrom = config.smtpUsername || `no-reply@${domain}`;
  }

  async sendMail(options: {
    to: string;
    subject: string;
    text: string;
    html?: string;
    from?: string;
  }): Promise<void> {
    if (!options.to) return;
    if (!this.transporter) {
      this.logger.warn(
        `Skipping email to ${options.to}: SMTP is not configured (subject: ${options.subject})`
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: options.from ?? this.defaultFrom,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html ?? options.text,
      });
    } catch (err) {
      const e = err as Error & { response?: string };
      this.logger.error(
        `Failed to send email to ${options.to}: ${e.message}${e.response ? `\n${e.response}` : ""}`
      );
    }
  }
}
