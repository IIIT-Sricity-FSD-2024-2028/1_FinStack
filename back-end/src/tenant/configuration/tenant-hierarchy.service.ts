import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ListHierarchyDto } from './dto/list-hierarchy.dto';

const literal = (value: string) => value.replace(/[\\%_]/g, '\\$&');
export const hierarchySelect = (organizationId: string) =>
  ({
    id: true,
    employeeId: true,
    firstName: true,
    lastName: true,
    email: true,
    department: true,
    role: true,
    status: true,
    managerId: true,
    manager: {
      where: { organizationId },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        status: true,
      },
    },
    _count: { select: { directReports: { where: { organizationId } } } },
  }) satisfies Prisma.TenantUserSelect;
type Row = Prisma.TenantUserGetPayload<{
  select: ReturnType<typeof hierarchySelect>;
}>;
const dto = ({ firstName, lastName, _count, manager, ...row }: Row) => ({
  ...row,
  fullName: `${firstName} ${lastName}`,
  directReportCount: _count.directReports,
  manager: manager
    ? {
        id: manager.id,
        employeeId: manager.employeeId,
        fullName: `${manager.firstName} ${manager.lastName}`,
        status: manager.status,
      }
    : null,
});

@Injectable()
export class TenantHierarchyService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(organizationId: string, query: ListHierarchyDto) {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const [counts] = await tx.$queryRaw<
          {
            total: number;
            active: number;
            unassigned: number;
            inactiveManagers: number;
            departments: number;
          }[]
        >`
        SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='ACTIVE')::int AS active,
          COUNT(*) FILTER (WHERE "managerId" IS NULL)::int AS unassigned,
          COUNT(*) FILTER (WHERE status='INACTIVE' AND EXISTS(SELECT 1 FROM "TenantUser" r WHERE r."managerId"=u.id AND r."organizationId"=u."organizationId"))::int AS "inactiveManagers",
          COUNT(DISTINCT department)::int AS departments
        FROM "TenantUser" u WHERE "organizationId"=${organizationId}::uuid`;
        const departments = await tx.tenantUser.groupBy({
          by: ['department'],
          where: { organizationId },
          _count: { _all: true },
          orderBy: { department: 'asc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        });
        return {
          ...counts,
          departmentPage: query.page,
          departmentTotalPages: Math.ceil(counts.departments / query.pageSize),
          departments: departments.map((d) => ({
            name: d.department,
            total: d._count._all,
          })),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return result;
  }

  async branch(organizationId: string, query: ListHierarchyDto) {
    if (query.view === 'REPORTS' && !query.managerId)
      throw new BadRequestException(
        'managerId is required for direct reports.',
      );
    if (query.view === 'DEPARTMENT' && !query.department)
      throw new BadRequestException('department is required.');
    if (query.view === 'REPORTS')
      await this.requireUser(organizationId, query.managerId!);
    const terms = (query.search || '').split(/\s+/).filter(Boolean);
    const where: Prisma.TenantUserWhereInput = {
      organizationId,
      ...(query.view === 'ROOTS' ? { managerId: null } : {}),
      ...(query.view === 'REPORTS' ? { managerId: query.managerId } : {}),
      ...(query.department ? { department: query.department } : {}),
      ...(query.role ? { role: query.role } : {}),
      ...(query.view === 'CANDIDATES'
        ? { status: 'ACTIVE', credentialSetupRequired: false }
        : query.status
          ? { status: query.status }
          : {}),
      AND: terms.map((term) => ({
        OR: ['employeeId', 'firstName', 'lastName', 'email'].map((field) => ({
          [field]: { contains: literal(term), mode: 'insensitive' },
        })),
      })),
    };
    const [total, rows] = await this.prisma.$transaction(
      [
        this.prisma.tenantUser.count({ where }),
        this.prisma.tenantUser.findMany({
          where,
          select: hierarchySelect(organizationId),
          orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }, { id: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return {
      items: rows.map(dto),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize),
      hasNextPage: query.page * query.pageSize < total,
      hasPreviousPage: query.page > 1,
    };
  }

  async employee(organizationId: string, id: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const user = await tx.tenantUser.findFirst({
          where: { id, organizationId },
          select: hierarchySelect(organizationId),
        });
        if (!user)
          throw new NotFoundException(
            'Employee not found in this organization.',
          );
        // One recursive query, bounded output, tenant constraint at every step.
        const ancestors = await tx.$queryRaw<
          {
            id: string;
            fullName: string;
            employeeId: string;
            managerId: string | null;
            depth: number;
            cycle: boolean;
          }[]
        >`
        WITH RECURSIVE chain AS (
          SELECT id, "firstName" || ' ' || "lastName" AS "fullName", "employeeId", "managerId", 0 AS depth, ARRAY[id] AS visited, false AS cycle
          FROM "TenantUser" WHERE id=${id}::uuid AND "organizationId"=${organizationId}::uuid
          UNION ALL
          SELECT u.id, u."firstName" || ' ' || u."lastName", u."employeeId", u."managerId", c.depth+1, c.visited || u.id, u.id=ANY(c.visited)
          FROM "TenantUser" u JOIN chain c ON u.id=c."managerId"
          WHERE u."organizationId"=${organizationId}::uuid AND NOT c.cycle AND c.depth<100
        ) SELECT id,"fullName","employeeId","managerId",depth,cycle FROM chain ORDER BY depth DESC`;
        return {
          ...dto(user),
          ancestors: ancestors.filter((a) => a.id !== id && !a.cycle),
          pathTruncated:
            ancestors.some((a) => a.cycle) ||
            (ancestors[0]?.depth === 100 && ancestors[0]?.managerId !== null),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  private async requireUser(organizationId: string, id: string) {
    if (
      !(await this.prisma.tenantUser.findFirst({
        where: { organizationId, id },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Employee not found in this organization.');
  }
}
