import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const error = this.getError(exception, status);

    response.status(status).json({
      success: false,
      error,
      message: error.message,
    });
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
