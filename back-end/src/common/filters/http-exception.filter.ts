import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppLoggerService } from '../logging/app-logger.service';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = isHttpException
      ? this.getHttpExceptionMessage(exception)
      : 'Internal server error';

    this.logger.logException({
      requestId: request.requestId,
      method: request.method,
      path: request.path,
      statusCode: status,
      exceptionName: this.getExceptionName(exception),
      message,
      stack:
        !isHttpException && exception instanceof Error
          ? exception.stack
          : undefined,
    });

    response.status(status).json({
      success: false,
      message,
      ...(request.requestId ? { requestId: request.requestId } : {}),
    });
  }

  private getHttpExceptionMessage(exception: HttpException): string {
    const response = exception.getResponse();

    if (typeof response === 'string') {
      return response;
    }

    if (typeof response === 'object' && response !== null) {
      const body = response as { message?: string | string[]; error?: string };
      if (Array.isArray(body.message)) {
        return body.message.join(', ');
      }
      return body.message || body.error || exception.message;
    }

    return exception.message;
  }

  private getExceptionName(exception: unknown): string {
    return exception instanceof Error
      ? exception.name
      : 'UnknownException';
  }
}
