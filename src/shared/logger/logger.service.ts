import { Injectable, LoggerService } from '@nestjs/common';
import * as winston from 'winston';

@Injectable()
export class AppLoggerService implements LoggerService {
  private readonly logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.simple(),
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'app.log' }),
      ],
    });
  }

  log(message: string, context?: string): void {
    this.logger.info(context ? `[${context}] ${message}` : message);
  }

  error(message: string, _trace?: string, context?: string): void {
    this.logger.error(context ? `[${context}] ${message}` : message);
  }

  warn(message: string, context?: string): void {
    this.logger.warn(context ? `[${context}] ${message}` : message);
  }

  debug(message: string, context?: string): void {
    this.logger.debug(context ? `[${context}] ${message}` : message);
  }
}
