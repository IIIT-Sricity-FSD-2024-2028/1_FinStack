import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T> | StreamableFile>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T> | StreamableFile> {
    return next.handle().pipe(
      map((value) => {
        if (value instanceof StreamableFile) {
          return value;
        }

        if (this.isApiResponse(value)) {
          return value;
        }

        return {
          success: true,
          data: value,
        };
      }),
    );
  }

  private isApiResponse(value: unknown): value is ApiResponse<T> {
    return (
      typeof value === 'object' &&
      value !== null &&
      'success' in value &&
      typeof (value as ApiResponse<T>).success === 'boolean'
    );
  }
}
