import { AsyncLocalStorage } from 'node:async_hooks';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantRole } from '@prisma/client';
import { TenantAuthContext, TenantRequest } from '../auth/tenant-auth.types';
export interface AuditActor {
  organizationId: string;
  actorUserId: string | null;
  actorName: string;
  actorRole: TenantRole | null;
  actorKind: 'USER' | 'SYSTEM';
  initiatedByUserId?: string;
}
export const auditContext = new AsyncLocalStorage<AuditActor>();
export function auditActor(actor: TenantAuthContext): AuditActor {
  return {
    organizationId: actor.organizationId,
    actorUserId: actor.user.id,
    actorName: `${actor.user.firstName} ${actor.user.lastName}`,
    actorRole: actor.user.role,
    actorKind: 'USER',
  };
}
export function workerActor(job: {
  organizationId: string;
  confirmedById: string | null;
  createdById: string;
}): AuditActor {
  return {
    organizationId: job.organizationId,
    actorUserId: null,
    actorName: 'Employee provisioning worker',
    actorRole: null,
    actorKind: 'SYSTEM',
    initiatedByUserId: job.confirmedById || job.createdById,
  };
}
@Injectable()
export class TenantAuditContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const actor = context.switchToHttp().getRequest<TenantRequest>().tenantAuth;
    if (!actor) return next.handle();
    return new Observable((subscriber) =>
      auditContext.run(auditActor(actor), () =>
        next.handle().subscribe(subscriber),
      ),
    );
  }
}
