import { Injectable, LoggerService, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createLogger, Logger } from 'winston';
import { AppConfiguration } from '../config/configuration';
import { createLoggerOptions } from './logging.config';

export interface HttpCompletionLog {
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
}

export interface ExceptionLog {
  requestId?: string;
  method: string;
  path: string;
  statusCode: number;
  exceptionName: string;
  message: string;
  stack?: string;
}

@Injectable()
export class AppLoggerService implements LoggerService, OnApplicationShutdown {
  private readonly logger: Logger;

  constructor(configService: ConfigService<AppConfiguration, true>) {
    this.logger = createLogger(createLoggerOptions(configService));
  }

  log(message: unknown, context?: string): void {
    this.logger.info(this.toMessage(message), { context });
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.logger.error(this.toMessage(message), {
      context,
      exceptionEvent: true,
      stack: trace,
    });
  }

  warn(message: unknown, context?: string): void {
    this.logger.warn(this.toMessage(message), { context });
  }

  debug(message: unknown, context?: string): void {
    this.logger.debug(this.toMessage(message), { context });
  }

  verbose(message: unknown, context?: string): void {
    this.logger.verbose(this.toMessage(message), { context });
  }

  logHttpCompletion(event: HttpCompletionLog): void {
    const level =
      event.statusCode >= 500
        ? 'error'
        : event.statusCode >= 400
          ? 'warn'
          : 'info';

    this.logger.log(level, 'HTTP request completed', {
      context: 'HttpRequest',
      ...event,
    });
  }

  logException(event: ExceptionLog): void {
    const level = event.statusCode >= 500 ? 'error' : 'warn';
    const { message, ...metadata } = event;

    this.logger.log(level, message, {
      context: 'HttpException',
      exceptionEvent: true,
      ...metadata,
    });
  }

  onApplicationShutdown(): void {
    this.logger.close();
  }

  private toMessage(message: unknown): string {
    return typeof message === 'string' ? message : String(message);
  }
}
