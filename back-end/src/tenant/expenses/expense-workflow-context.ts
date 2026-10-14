import { AsyncLocalStorage } from 'node:async_hooks';
import { Prisma } from '@prisma/client';
import { TenantAuthContext } from '../auth/tenant-auth.types';

// Request-local transaction, never a shared mutable connection or cache.
export const expenseWorkflowContext = new AsyncLocalStorage<{
  tx: Prisma.TransactionClient;
  actor: TenantAuthContext;
}>();
