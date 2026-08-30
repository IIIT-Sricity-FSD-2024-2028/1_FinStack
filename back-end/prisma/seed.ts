import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const permissions = [
  ['platform.organization.view', 'View organizations'],
  ['platform.organization.create', 'Create organizations'],
  ['platform.organization.update', 'Update organization metadata'],
  ['platform.organization.suspend', 'Suspend organizations'],
  ['platform.organization.reactivate', 'Reactivate organizations'],
  ['platform.organization.cancel', 'Cancel organizations'],
  ['platform.organization.archive', 'Archive organizations'],
  ['platform.staff.view', 'View platform staff'],
  ['platform.staff.create', 'Create platform staff'],
  ['platform.staff.update', 'Update platform staff'],
  ['platform.staff.disable', 'Disable platform staff'],
  ['platform.role.view', 'View platform roles and permissions'],
  ['platform.role.manage', 'Manage platform roles and permissions'],
  ['platform.audit.view', 'View platform audit logs'],
  ['platform.notification.view', 'View platform notifications'],
  ['platform.notification.manage', 'Manage platform notifications'],
] as const;

const roles = [
  ['PLATFORM_SUPER_ADMIN', 'Platform Super Admin'],
  ['SUPPORT_AGENT', 'Customer Support Agent'],
  ['BILLING_STAFF', 'Billing / Finance Staff'],
  ['PLATFORM_OPS', 'Platform Operations Staff'],
] as const;

const bootstrapKeys = [
  'PLATFORM_BOOTSTRAP_ADMIN_EMAIL',
  'PLATFORM_BOOTSTRAP_ADMIN_FIRST_NAME',
  'PLATFORM_BOOTSTRAP_ADMIN_LAST_NAME',
  'PLATFORM_BOOTSTRAP_ADMIN_PASSWORD',
] as const;

async function seedCatalog(prisma: PrismaClient): Promise<string> {
  const seededPermissions = await Promise.all(
    permissions.map(([key, description]) =>
      prisma.permission.upsert({
        where: { key },
        update: { description },
        create: { key, description },
      }),
    ),
  );

  const seededRoles = await Promise.all(
    roles.map(([key, name]) =>
      prisma.platformRole.upsert({
        where: { key },
        update: { name, isSystemPreset: true, isActive: true },
        create: { key, name, isSystemPreset: true, isActive: true },
      }),
    ),
  );

  const superAdmin = seededRoles.find(
    (role) => role.key === 'PLATFORM_SUPER_ADMIN',
  );
  if (!superAdmin) {
    throw new Error('The platform super administrator role was not seeded.');
  }

  await prisma.$transaction([
    prisma.platformRolePermission.deleteMany({
      where: { roleId: superAdmin.id },
    }),
    prisma.platformRolePermission.createMany({
      data: seededPermissions.map((permission) => ({
        roleId: superAdmin.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    }),
  ]);

  return superAdmin.id;
}

async function seedBootstrapAdmin(
  prisma: PrismaClient,
  superAdminRoleId: string,
  environment: NodeJS.ProcessEnv,
): Promise<'created-or-assigned' | 'skipped'> {
  const values = bootstrapKeys.map((key) => environment[key]?.trim() ?? '');
  if (values.every((value) => value.length === 0)) {
    return 'skipped';
  }

  const missingKeys = bootstrapKeys.filter(
    (_key, index) => values[index].length === 0,
  );
  if (missingKeys.length > 0) {
    throw new Error(
      `Bootstrap administrator configuration is incomplete: ${missingKeys.join(', ')}`,
    );
  }

  const [emailValue, firstName, lastName, password] = values;
  const email = emailValue.toLowerCase();
  let staff = await prisma.platformStaff.findUnique({ where: { email } });

  if (!staff) {
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
    });
    staff = await prisma.platformStaff.create({
      data: { email, firstName, lastName, passwordHash },
    });
  }

  await prisma.platformStaffRole.upsert({
    where: {
      staffId_roleId: { staffId: staff.id, roleId: superAdminRoleId },
    },
    update: {},
    create: { staffId: staff.id, roleId: superAdminRoleId },
  });

  return 'created-or-assigned';
}

export async function seedPlatformAuthRbac(
  prisma: PrismaClient,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<'created-or-assigned' | 'skipped'> {
  const superAdminRoleId = await seedCatalog(prisma);
  return seedBootstrapAdmin(prisma, superAdminRoleId, environment);
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const bootstrapResult = await seedPlatformAuthRbac(prisma);
    if (bootstrapResult === 'skipped') {
      console.log(
        'Bootstrap administrator skipped; no bootstrap variables set.',
      );
    } else {
      console.log('Bootstrap administrator role assignment ensured.');
    }
  } finally {
    await prisma.$disconnect();
  }
  console.log('Platform authentication and RBAC seed completed.');
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Platform seed failed: ${message}`);
    process.exitCode = 1;
  });
}
