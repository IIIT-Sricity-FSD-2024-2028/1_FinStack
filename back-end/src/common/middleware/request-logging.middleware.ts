import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { AppLoggerService } from '../logging/app-logger.service';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  constructor(private readonly logger: AppLoggerService) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const startedAt = process.hrtime.bigint();

    response.once('finish', () => {
      const durationNanoseconds = process.hrtime.bigint() - startedAt;
      const durationMs = Number(durationNanoseconds) / 1_000_000;

      this.logger.logHttpCompletion({
        requestId: request.requestId ?? 'unavailable',
        method: request.method,
        path: request.path,
        statusCode: response.statusCode,
        durationMs: Number(durationMs.toFixed(3)),
      });
    });

    next();
  }
}
