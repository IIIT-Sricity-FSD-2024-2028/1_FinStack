import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map } from 'rxjs';
import { publicEmployeeIdentity } from './public-employee-identity';

// Installed only on tenant controllers exposing employee DTOs, never platform APIs.
@Injectable()
export class TenantEmployeeIdentityInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler) {
    return next
      .handle()
      .pipe(map((value: unknown) => publicEmployeeIdentity(value)));
  }
}
