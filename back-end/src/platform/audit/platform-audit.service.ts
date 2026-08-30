import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

const ALLOWED_AUDIT_METADATA_KEYS = new Set([
  'requestId',
  'correlationId',
  'statusBefore',
  'statusAfter',
  'resourceId',
  'resourceType',
  'source',
  'feature',
  'targetStatus',
]);

export interface RecordAuditEventInput {
  actorStaffId?: string | null;
  eventCode: string;
  category: string;
  resourceType: string;
  resourceId?: string | null;
  summary: string;
  metadata?: Record<string, unknown> | null;
  requestId?: string | null;
  correlationId?: string | null;
}

export interface PlatformAuditLogListQuery {
  page: number;
  limit: number;
  search?: string;
  category?: string;
  resourceType?: string;
  actorStaffId?: string;
  sortBy?: 'createdAt';
  order?: 'asc' | 'desc';
}

@Injectable()
export class PlatformAuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PlatformAuditLogListQuery): Promise<{
    items: unknown[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const order = query.order ?? 'desc';
    const sortBy = query.sortBy ?? 'createdAt';
    const where: Prisma.PlatformAuditLogWhereInput = {};

    if (query.category) {
      where.category = query.category;
    }
    if (query.resourceType) {
      where.resourceType = query.resourceType;
    }
    if (query.actorStaffId) {
      where.actorStaffId = query.actorStaffId;
    }
    if (query.search) {
      where.OR = [
        { summary: { contains: query.search, mode: 'insensitive' } },
        { eventCode: { contains: query.search, mode: 'insensitive' } },
        { resourceId: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.platformAuditLog.findMany({
        where,
        orderBy: { [sortBy]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.platformAuditLog.count({ where }),
    ]);

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async findOne(id: string): Promise<unknown> {
    const auditLog = await this.prisma.platformAuditLog.findUnique({
      where: { id },
    });
    if (!auditLog) {
      throw new NotFoundException({
        code: 'PLATFORM_AUDIT_LOG_NOT_FOUND',
        message: 'Platform audit log not found.',
      });
    }
    return auditLog;
  }

  async recordEvent(input: RecordAuditEventInput): Promise<unknown> {
    const metadata = this.sanitizeMetadata(input.metadata);

    return this.prisma.platformAuditLog.create({
      data: {
        actorStaffId: input.actorStaffId ?? null,
        eventCode: input.eventCode,
        category: input.category,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        summary: input.summary,
        metadata:
          metadata === null
            ? Prisma.JsonNull
            : (metadata as Prisma.InputJsonValue),
        requestId: input.requestId ?? null,
        correlationId: input.correlationId ?? null,
      },
    });
  }

  private sanitizeMetadata(
    metadata?: Record<string, unknown> | null,
  ): Record<string, unknown> | null {
    if (!metadata || typeof metadata !== 'object') {
      return null;
    }

    const safe: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (!ALLOWED_AUDIT_METADATA_KEYS.has(key)) {
        continue;
      }
      if (value === undefined || value === null) {
        continue;
      }
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        safe[key] = value;
      } else if (Array.isArray(value)) {
        safe[key] = value.filter(
          (entry) =>
            typeof entry === 'string' ||
            typeof entry === 'number' ||
            typeof entry === 'boolean',
        );
      }
    }
    return Object.keys(safe).length > 0 ? safe : null;
  }
}
