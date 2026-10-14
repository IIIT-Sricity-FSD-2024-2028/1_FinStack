import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma.service';
import { TenantAuthContext } from '../auth/tenant-auth.types';
import { appendAudit } from '../audit/tenant-audit-write';
import { auditActor } from '../audit/tenant-audit-context';
import {
  OrganizationSettingsDto,
  ProfileSettingsDto,
  ChangeOwnPasswordDto,
  TenantPreferencesDto,
} from './tenant-settings.dto';
const defaultPreferences: TenantPreferencesDto = {
  theme: 'dark',
  compactMode: false,
  animations: true,
  language: 'en-US',
  dateFormat: 'DD/MM/YYYY',
  timezone: 'Asia/Kolkata',
  numberLocale: 'en-US',
  desktopNotifications: false,
  defaultView: 'dashboard',
  pageSize: 25,
  autoRefresh: false,
  managerCurrency: 'INR',
  managerDefaultPage: 'dashboard',
  emailAlerts: true,
  weeklyDigest: true,
};
const profileSelect = {
  id: true,
  organizationId: true,
  employeeId: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  status: true,
  department: true,
  phone: true,
  location: true,
  avatarColor: true,
} satisfies Prisma.TenantUserSelect;
function object(value: Prisma.JsonValue | undefined): Prisma.JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}
@Injectable()
export class TenantSettingsService {
  constructor(private readonly prisma: PrismaService) {}
  async organization(actor: TenantAuthContext) {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: actor.organizationId },
      select: {
        id: true,
        name: true,
        primaryEmail: true,
        defaultCurrency: true,
        timezone: true,
        registrationIdentifier: true,
        metadata: true,
      },
    });
    const metadata = object(org.metadata ?? undefined);
    const settings = object(metadata.tenantSettings);
    return {
      ...org,
      metadata: undefined,
      address: typeof metadata.address === 'string' ? metadata.address : '',
      taxId: typeof metadata.taxId === 'string' ? metadata.taxId : '',
      companySize: settings.companySize ?? '',
      fiscalYearStart: settings.fiscalYearStart ?? 'April',
      defaultPaymentMethod: settings.defaultPaymentMethod ?? 'Bank Transfer',
    };
  }
  async updateOrganization(
    actor: TenantAuthContext,
    dto: OrganizationSettingsDto,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${actor.organizationId}::uuid FOR UPDATE`;
      const org = await tx.organization.findUniqueOrThrow({
        where: { id: actor.organizationId },
        select: { metadata: true },
      });
      await tx.organization.update({
        where: { id: actor.organizationId },
        data: {
          metadata: {
            ...object(org.metadata ?? undefined),
            tenantSettings: { ...dto },
          },
        },
      });
      await appendAudit(
        tx,
        actor.organizationId,
        'organization.settings_updated',
        'organization',
        actor.organizationId,
        { changedFields: Object.keys(dto) },
        auditActor(actor),
      );
    });
    return this.organization(actor);
  }
  async exportConfiguration(actor: TenantAuthContext) {
    const scope = { organizationId: actor.organizationId };
    const [organization, employees, categories, policies, auditLogs] =
      await Promise.all([
        this.organization(actor),
        this.prisma.tenantUser.findMany({
          where: scope,
          select: profileSelect,
          orderBy: { id: 'asc' },
          take: 10000,
        }),
        this.prisma.expenseCategory.findMany({
          where: scope,
          orderBy: { id: 'asc' },
          take: 10000,
        }),
        this.prisma.expensePolicy.findMany({
          where: scope,
          orderBy: { id: 'asc' },
          take: 10000,
        }),
        this.prisma.tenantAuditLog.findMany({
          where: scope,
          orderBy: { occurredAt: 'desc' },
          take: 10000,
        }),
      ]);
    await this.prisma.$transaction((tx) =>
      appendAudit(
        tx,
        actor.organizationId,
        'organization.configuration_exported',
        'organization',
        actor.organizationId,
        { recordLimitPerType: 10000 },
        auditActor(actor),
      ),
    );
    return {
      organization,
      employees,
      categories,
      policies,
      auditLogs,
      recordLimitPerType: 10000,
      scope:
        'Tenant configuration only; each collection is limited to 10000 records. Use paginated audit export for larger histories.',
    };
  }
  profile(actor: TenantAuthContext) {
    return this.prisma.tenantUser.findFirstOrThrow({
      where: { id: actor.user.id, organizationId: actor.organizationId },
      select: profileSelect,
    });
  }
  async preferences(actor: TenantAuthContext) {
    const rows = await this.prisma.$queryRaw<
      { preferences: Prisma.JsonValue | null }[]
    >`
      SELECT preferences FROM "TenantUser"
      WHERE id = ${actor.user.id}::uuid AND "organizationId" = ${actor.organizationId}::uuid
    `;
    if (!rows[0])
      throw new BadRequestException('Authenticated profile was not found.');
    return {
      ...defaultPreferences,
      ...(object(
        rows[0].preferences ?? undefined,
      ) as Partial<TenantPreferencesDto>),
    };
  }
  async updatePreferences(actor: TenantAuthContext, dto: TenantPreferencesDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.$queryRaw<
        { preferences: Prisma.JsonValue | null }[]
      >`
        UPDATE "TenantUser" SET preferences = ${JSON.stringify(dto)}::jsonb
        WHERE id = ${actor.user.id}::uuid AND "organizationId" = ${actor.organizationId}::uuid
        RETURNING preferences
      `;
      if (!updated[0])
        throw new BadRequestException('Authenticated profile was not found.');
      await appendAudit(
        tx,
        actor.organizationId,
        'profile.preferences_updated',
        'employee',
        actor.user.id,
        { changedFields: Object.keys(dto) },
        auditActor(actor),
      );
      return updated[0].preferences;
    });
    return {
      ...defaultPreferences,
      ...(object(result ?? undefined) as Partial<TenantPreferencesDto>),
    };
  }
  async updateProfile(actor: TenantAuthContext, dto: ProfileSettingsDto) {
    const parts = dto.fullName.trim().split(/\s+/);
    const firstName = parts.shift() ?? '';
    const lastName = parts.join(' ');
    if (!firstName || firstName.length > 100 || lastName.length > 100)
      throw new BadRequestException({
        code: 'INVALID_PROFILE',
        message:
          'Use a name with first and remaining names up to 100 characters each.',
      });
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.tenantUser.findFirstOrThrow({
        where: { id: actor.user.id, organizationId: actor.organizationId },
        select: { id: true },
      });
      const result = await tx.tenantUser.update({
        where: { id: row.id },
        data: {
          firstName,
          lastName,
          phone: dto.phone?.trim(),
          location: dto.location?.trim(),
          avatarColor: dto.avatarColor,
        },
        select: profileSelect,
      });
      await appendAudit(
        tx,
        actor.organizationId,
        'profile.updated',
        'employee',
        row.id,
        { changedFields: Object.keys(dto) },
        auditActor(actor),
      );
      return result;
    });
  }
  async changePassword(actor: TenantAuthContext, dto: ChangeOwnPasswordDto) {
    if (
      dto.newPassword !== dto.confirmPassword ||
      dto.newPassword === dto.currentPassword
    )
      throw new BadRequestException({
        code: 'INVALID_NEW_PASSWORD',
        message:
          'Choose a different password and make both new password fields match.',
      });
    const user = await this.prisma.tenantUser.findFirstOrThrow({
      where: { id: actor.user.id, organizationId: actor.organizationId },
    });
    if (
      !(await argon2
        .verify(user.passwordHash, dto.currentPassword)
        .catch(() => false))
    )
      throw new BadRequestException({
        code: 'CURRENT_PASSWORD_INCORRECT',
        message: 'Current password is incorrect.',
      });
    const passwordHash = await argon2.hash(dto.newPassword);
    await this.prisma.$transaction(async (tx) => {
      const update = await tx.tenantUser.updateMany({
        where: {
          id: user.id,
          organizationId: actor.organizationId,
          passwordHash: user.passwordHash,
        },
        data: { passwordHash, credentialVersion: { increment: 1 } },
      });
      if (update.count !== 1)
        throw new BadRequestException({
          code: 'PASSWORD_CHANGED',
          message: 'Credentials changed during this request. Sign in again.',
        });
      await appendAudit(
        tx,
        actor.organizationId,
        'profile.password_changed',
        'employee',
        user.id,
        { sessionsRevoked: true },
        auditActor(actor),
      );
    });
    return { signInRequired: true };
  }
  async revokeSessions(actor: TenantAuthContext) {
    await this.prisma.$transaction(async (tx) => {
      await tx.tenantUser.updateMany({
        where: { id: actor.user.id, organizationId: actor.organizationId },
        data: { credentialVersion: { increment: 1 } },
      });
      await appendAudit(
        tx,
        actor.organizationId,
        'profile.sessions_revoked',
        'employee',
        actor.user.id,
        { sessionsRevoked: true },
        auditActor(actor),
      );
    });
    return { signInRequired: true };
  }
}
