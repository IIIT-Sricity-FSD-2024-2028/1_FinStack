import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Prisma, TenantRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TenantAuthenticationGuard } from '../auth/guards/tenant-authentication.guard';
import { TenantRoleGuard } from '../auth/guards/tenant-role.guard';
import { TenantRoles } from '../auth/decorators/tenant-roles.decorator';
import { TenantRequest } from '../auth/tenant-auth.types';
// Exact events emitted by the persistent expense repository/service. Do not
// replace with a prefix match: future expense events require explicit review.
const complianceExpenseEvents = [
  'expense.submitted',
  'expense.resubmitted',
  'expense.updated',
  'expense.deleted',
  'expense.manager_approved',
  'expense.manager_returned',
  'expense.manager_rejected',
  'expense.manager_escalated',
  'expense.finance_approved',
  'expense.finance_rejected',
  'expense.finance_requested_info',
  'expense.finance_flagged',
  'expense.compliance_approved',
  'expense.compliance_rejected',
  'expense.compliance_corrective_action',
  'expense.payment_released',
];
const complianceFields = [
  'id',
  'occurredAt',
  'actorKind',
  'actorName',
  'actorRole',
  'eventCode',
  'targetType',
  'targetId',
  'outcome',
] as const;
const complianceSelect = {
  id: true,
  occurredAt: true,
  actorKind: true,
  actorName: true,
  actorRole: true,
  eventCode: true,
  targetType: true,
  targetId: true,
  outcome: true,
} satisfies Prisma.TenantAuditLogSelect;

function scopedAuditWhere(req: TenantRequest, query: AuditQuery) {
  const where = auditWhere(req.tenantAuth!.organizationId, query);
  return req.tenantAuth!.user.role === TenantRole.COMPLIANCE_OFFICER
    ? {
        AND: [
          where,
          {
            OR: [
              {
                targetType: 'expense',
                eventCode: { in: complianceExpenseEvents },
              },
              {
                targetType: 'expense_payment',
                eventCode: 'expense.payment_failed',
              },
            ],
          },
        ],
      }
    : where;
}
export class AuditQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 25;
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @IsString() @MaxLength(100) eventCode?: string;
  @IsOptional()
  @IsIn([
    'organization',
    'employee',
    'category',
    'policy',
    'category_batch',
    'policy_batch',
    'import',
    'credential',
    'expense',
    'expense_payment',
  ])
  targetType?: string;
  @IsOptional() @IsUUID() actorUserId?: string;
  @IsOptional() @IsIn(['SUCCESS', 'FAILED']) outcome?: string;
  @IsOptional() @IsISO8601({ strict: true }) from?: string;
  @IsOptional() @IsISO8601({ strict: true }) to?: string;
}
export function auditWhere(
  organizationId: string,
  query: AuditQuery,
): Prisma.TenantAuditLogWhereInput {
  if (query.from && query.to && new Date(query.from) > new Date(query.to))
    throw new BadRequestException('From must precede To.');
  const literal = (query.search || '').trim().replace(/[\\%_]/g, '\\$&');
  return {
    organizationId,
    ...(query.eventCode ? { eventCode: query.eventCode } : {}),
    ...(query.targetType ? { targetType: query.targetType } : {}),
    ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
    ...(query.outcome ? { outcome: query.outcome } : {}),
    ...(query.from || query.to
      ? {
          occurredAt: {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(query.to) } : {}),
          },
        }
      : {}),
    ...(literal
      ? {
          OR: ['actorName', 'eventCode', 'targetType', 'targetId'].map(
            (field) => ({
              [field]: { contains: literal, mode: 'insensitive' },
            }),
          ),
        }
      : {}),
  };
}
export function auditCsvCell(value: unknown): string {
  const raw =
    value == null
      ? ''
      : typeof value === 'object'
        ? JSON.stringify(value)
        : typeof value === 'string'
          ? value
          : typeof value === 'number' || typeof value === 'boolean'
            ? String(value)
            : '';
  return (
    '"' + (/^[\s]*[=+@-]/.test(raw) ? "'" + raw : raw).replace(/"/g, '""') + '"'
  );
}
@Controller('configuration/audit-logs')
@UseGuards(TenantAuthenticationGuard, TenantRoleGuard)
@TenantRoles(TenantRole.CONFIGURATION_MANAGER)
export class TenantAuditController {
  constructor(private readonly prisma: PrismaService) {}
  @Get()
  @TenantRoles(TenantRole.CONFIGURATION_MANAGER, TenantRole.COMPLIANCE_OFFICER)
  async list(@Req() req: TenantRequest, @Query() query: AuditQuery) {
    if ((query.page - 1) * query.pageSize > 100000)
      throw new BadRequestException(
        'Narrow filters to page within the first 100,000 matching events.',
      );
    const where = scopedAuditWhere(req, query);
    const [total, items] = await this.prisma.$transaction(
      [
        this.prisma.tenantAuditLog.count({ where }),
        this.prisma.tenantAuditLog.findMany({
          where,
          select:
            req.tenantAuth!.user.role === TenantRole.COMPLIANCE_OFFICER
              ? complianceSelect
              : {
                  id: true,
                  organizationId: true,
                  actorUserId: true,
                  actorKind: true,
                  actorName: true,
                  actorRole: true,
                  initiatedByUserId: true,
                  eventCode: true,
                  targetType: true,
                  targetId: true,
                  outcome: true,
                  occurredAt: true,
                },
          orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }
  @Get('export')
  @TenantRoles(TenantRole.CONFIGURATION_MANAGER, TenantRole.COMPLIANCE_OFFICER)
  async export(@Req() req: TenantRequest, @Query() query: AuditQuery) {
    const isCompliance =
      req.tenantAuth!.user.role === TenantRole.COMPLIANCE_OFFICER;
    const keys = isCompliance
      ? complianceFields
      : ([
          'id',
          'occurredAt',
          'actorKind',
          'actorUserId',
          'actorName',
          'actorRole',
          'initiatedByUserId',
          'eventCode',
          'targetType',
          'targetId',
          'outcome',
          'changes',
        ] as const);
    const where = scopedAuditWhere(req, query);
    const csv = await this.prisma.$transaction(
      async (tx) => {
        const lines = [keys.join(',')];
        let count = 0,
          bytes = 0,
          cursor: string | undefined;
        while (true) {
          const items = await tx.tenantAuditLog.findMany({
            where,
            ...(isCompliance ? { select: complianceSelect } : {}),
            orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
            take: Math.min(250, 10001 - count),
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          });
          if (!items.length) break;
          for (const row of items) {
            if (++count > 10000)
              throw new BadRequestException(
                'Export exceeds 10,000 events. Narrow the filters.',
              );
            const line = keys
              .map((key: (typeof keys)[number]) =>
                auditCsvCell(
                  key === 'occurredAt'
                    ? row.occurredAt.toISOString()
                    : row[key],
                ),
              )
              .join(',');
            bytes += Buffer.byteLength(line) + 2;
            if (bytes > 10 * 1024 * 1024)
              throw new BadRequestException(
                'Export exceeds 10 MB. Narrow the filters.',
              );
            lines.push(line);
          }
          cursor = items[items.length - 1].id;
        }
        return lines.join('\r\n');
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 20000,
      },
    );
    return new StreamableFile(Buffer.from(csv + '\r\n'), {
      type: 'text/csv; charset=utf-8',
      disposition: 'attachment; filename="finstack-audit-logs.csv"',
    });
  }
  @Get(':id')
  @TenantRoles(TenantRole.CONFIGURATION_MANAGER)
  async detail(
    @Req() req: TenantRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const item = await this.prisma.tenantAuditLog.findFirst({
      where: { id, organizationId: req.tenantAuth!.organizationId },
    });
    if (!item) throw new NotFoundException('Audit event not found.');
    return item;
  }
}
