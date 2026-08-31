import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

const SERIALIZABLE_RETRY_LIMIT = 3;

export interface PlatformSerializableConflict {
  code: string;
  message: string;
}

export async function runPlatformSerializableTransaction<T>(
  prisma: PrismaService,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  conflict: PlatformSerializableConflict,
): Promise<T> {
  for (let attempt = 1; attempt <= SERIALIZABLE_RETRY_LIMIT; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      const isSerializationFailure =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034';
      if (!isSerializationFailure) {
        throw error;
      }
      if (attempt === SERIALIZABLE_RETRY_LIMIT) {
        throw new ConflictException(conflict);
      }
    }
  }
  throw new Error('Serializable transaction retry limit was not enforced.');
}
