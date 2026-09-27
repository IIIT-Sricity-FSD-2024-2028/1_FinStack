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
    const error = this.getError(exception, status);

    this.logger.logException({
      requestId: request.requestId,
      method: request.method,
      path: request.path,
      statusCode: status,
      exceptionName: this.getExceptionName(exception),
      message: error.message,
      stack:
        !isHttpException && exception instanceof Error
          ? exception.stack
          : undefined,
    });

    response.status(status).json({
      success: false,
      error,
      message: error.message,
      ...(request.requestId ? { requestId: request.requestId } : {}),
    });
  }

  private getExceptionName(exception: unknown): string {
    return exception instanceof Error
      ? exception.name
      : 'UnknownException';
  }

  private getError(
    exception: unknown,
    status: number,
  ): { code: string; message: string } {
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      return {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.',
      };
    }

    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (typeof response === 'string') {
        return { code: `HTTP_${status}`, message: response };
      }

      if (typeof response === 'object' && response !== null) {
        const body = response as {
          code?: string;
          message?: string | string[];
          error?: string;
        };
        const message = Array.isArray(body.message)
          ? body.message.join(', ')
          : body.message || body.error || exception.message;
        return { code: body.code || `HTTP_${status}`, message };
      }
    }
    return { code: `HTTP_${status}`, message: 'Request failed.' };
  }
}
