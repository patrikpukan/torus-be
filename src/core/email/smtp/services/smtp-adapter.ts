import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { EmailService } from '../../interfaces/email-service.interface';
import { SMTPConfig } from '../interfaces/smtp-config.interface';

@Injectable()
export class SMTPAdapter implements EmailService {
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly config: SMTPConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
  }

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.config.user,
      to,
      subject,
      html,
    });
  }
}
