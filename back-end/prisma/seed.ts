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
  ['platform.staff.activate', 'Activate platform staff'],
  ['platform.staff.role.assign', 'Assign and remove platform staff roles'],
  ['platform.role.view', 'View platform roles and permissions'],
  ['platform.role.manage', 'Manage platform roles and permissions'],

  ['subscription.plan.view', 'View subscription plans'],
  ['subscription.plan.manage', 'Manage subscription plans'],
  ['subscription.feature.view', 'View product features'],
  ['subscription.feature.manage', 'Manage product features'],
  ['subscription.subscription.view', 'View organization subscriptions'],
  ['subscription.subscription.manage', 'Manage organization subscriptions'],
  ['billing.invoice.view', 'View subscription invoices'],
  ['billing.payment.view', 'View subscription payments'],
  ['billing.payment.manage', 'Create and verify subscription payments'],
  ['billing.revenue.view', 'View billing and revenue metrics'],

  ['support.ticket.view', 'View support tickets'],
  ['support.ticket.create', 'Create support tickets'],
  [
    'support.ticket.update',
    'Update support ticket metadata and ordinary lifecycle status',
  ],
  ['support.ticket.reply', 'Reply to support tickets'],
  ['support.ticket.note', 'Add internal support ticket notes'],
  ['support.ticket.resolve', 'Resolve support tickets'],
  ['support.ticket.escalate', 'Escalate support tickets'],
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

  const billingStaff = seededRoles.find(
    (role) => role.key === 'BILLING_STAFF',
  );

  if (!billingStaff) {
    throw new Error('The billing staff role was not seeded.');
  }

  const billingPermissionKeys = new Set([
    'subscription.subscription.view',
    'subscription.subscription.manage',
    'billing.invoice.view',
    'billing.payment.view',
    'billing.payment.manage',
    'billing.revenue.view',
  ]);

  const billingPermissions = seededPermissions.filter((permission) =>
    billingPermissionKeys.has(permission.key),
  );

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

    prisma.platformRolePermission.createMany({
      data: billingPermissions.map((permission) => ({
        roleId: billingStaff.id,
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

export async function seedProductCatalog(
  prisma: PrismaClient,
): Promise<void> {
  const features = [
    {
      key: 'OCR_RECEIPT_EXTRACTION',
      name: 'OCR Receipt Extraction',
      valueType: 'BOOLEAN' as const,
    },
    {
      key: 'AI_RISK_SCORING',
      name: 'AI Risk Scoring',
      valueType: 'BOOLEAN' as const,
    },
    {
      key: 'ADVANCED_RECONCILIATION',
      name: 'Advanced Reconciliation',
      valueType: 'BOOLEAN' as const,
    },
    {
      key: 'ADVANCED_ANALYTICS',
      name: 'Advanced Analytics',
      description: 'Advanced reporting and analytics for finance operations.',
      valueType: 'BOOLEAN' as const,
    },
    {
      key: 'PRIORITY_SUPPORT',
      name: 'Priority Support',
      description: 'Priority access to FinStack support.',
      valueType: 'BOOLEAN' as const,
    },
    {
      key: 'CUSTOM_APPROVAL_WORKFLOW',
      name: 'Custom Approval Workflow',
      valueType: 'BOOLEAN' as const,
    },
    {
      key: 'MAX_USERS',
      name: 'Maximum Users',
      valueType: 'INTEGER' as const,
    },
    {
      key: 'OCR_MONTHLY_LIMIT',
      name: 'OCR Monthly Limit',
      valueType: 'INTEGER' as const,
    },
    {
      key: 'DATA_RETENTION_DAYS',
      name: 'Data Retention (days)',
      valueType: 'INTEGER' as const,
    },
  ];

  for (const feature of features) {
    await prisma.feature.upsert({
      where: { key: feature.key },
      update: {
        name: feature.name,
        description: feature.description,
        valueType: feature.valueType,
      },
      create: {
        key: feature.key,
        name: feature.name,
        description: feature.description,
        valueType: feature.valueType,
      },
    });
  }

  const plans = [
    {
      key: 'STARTER',
      name: 'Starter',
      billingInterval: 'MONTHLY' as const,
      basePrice: 2999,
      trialDays: 14,
      includedEmployeeCount: 25,
      additionalEmployeePrice: 99,
    },
    {
      key: 'PROFESSIONAL',
      name: 'Professional',
      billingInterval: 'MONTHLY' as const,
      basePrice: 7999,
      trialDays: 14,
      includedEmployeeCount: 100,
      additionalEmployeePrice: 79,
    },
    {
      key: 'ENTERPRISE',
      name: 'Enterprise',
      billingInterval: 'YEARLY' as const,
      basePrice: 79999,
      trialDays: 30,
      includedEmployeeCount: 1000,
      additionalEmployeePrice: 599,
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { key: plan.key },
      update: {
        name: plan.name,
        billingInterval: plan.billingInterval,
        basePrice: plan.basePrice,
        trialDays: plan.trialDays,
        includedEmployeeCount: plan.includedEmployeeCount,
        additionalEmployeePrice: plan.additionalEmployeePrice,
      },
      create: {
        key: plan.key,
        name: plan.name,
        billingInterval: plan.billingInterval,
        basePrice: plan.basePrice,
        trialDays: plan.trialDays,
        includedEmployeeCount: plan.includedEmployeeCount,
        additionalEmployeePrice: plan.additionalEmployeePrice,
      },
    });
  }

  const starter = await prisma.plan.findUnique({
    where: { key: 'STARTER' },
  });

  const professional = await prisma.plan.findUnique({
    where: { key: 'PROFESSIONAL' },
  });

  const enterprise = await prisma.plan.findUnique({
    where: { key: 'ENTERPRISE' },
  });

  const getFeature = async (key: string) =>
    (await prisma.feature.findUnique({ where: { key } }))!;

  const setPlanFeature = async (
    planId: string,
    key: string,
    input: { value?: number; isAddOn?: boolean; addOnPrice?: number } = {},
  ) => {
    const feature = await getFeature(key);
    await prisma.planFeature.upsert({
      where: { planId_featureId: { planId, featureId: feature.id } },
      update: {
        ...(input.value === undefined ? {} : { value: input.value }),
        isAddOn: input.isAddOn ?? false,
        addOnPrice: input.addOnPrice ?? 0,
        enabled: true,
      },
      create: {
        planId,
        featureId: feature.id,
        enabled: true,
        ...(input.value === undefined ? {} : { value: input.value }),
        isAddOn: input.isAddOn ?? false,
        addOnPrice: input.addOnPrice ?? 0,
      },
    });
  };

  if (starter) {
    await setPlanFeature(starter.id, 'ADVANCED_ANALYTICS', {
      isAddOn: true,
      addOnPrice: 799,
    });
    await setPlanFeature(starter.id, 'PRIORITY_SUPPORT', {
      isAddOn: true,
      addOnPrice: 999,
    });
    await prisma.planFeature.upsert({
      where: {
        planId_featureId: {
          planId: starter.id,
          featureId: (await getFeature('OCR_RECEIPT_EXTRACTION')).id,
        },
      },
      update: {},
      create: {
        planId: starter.id,
        featureId: (await getFeature('OCR_RECEIPT_EXTRACTION')).id,
        enabled: true,
      },
    });

    await prisma.planFeature.upsert({
      where: {
        planId_featureId: {
          planId: starter.id,
          featureId: (await getFeature('MAX_USERS')).id,
        },
      },
      update: { value: 25 },
      create: {
        planId: starter.id,
        featureId: (await getFeature('MAX_USERS')).id,
        enabled: true,
        value: 25,
      },
    });

    await prisma.planFeature.upsert({
      where: {
        planId_featureId: {
          planId: starter.id,
          featureId: (await getFeature('DATA_RETENTION_DAYS')).id,
        },
      },
      update: { value: 90 },
      create: {
        planId: starter.id,
        featureId: (await getFeature('DATA_RETENTION_DAYS')).id,
        enabled: true,
        value: 90,
      },
    });
  }

  if (professional) {
    await setPlanFeature(professional.id, 'ADVANCED_ANALYTICS', {
      isAddOn: true,
      addOnPrice: 499,
    });
    await setPlanFeature(professional.id, 'PRIORITY_SUPPORT', {
      isAddOn: true,
      addOnPrice: 699,
    });
    const proFeatures = [
      'OCR_RECEIPT_EXTRACTION',
      'AI_RISK_SCORING',
      'ADVANCED_RECONCILIATION',
      'CUSTOM_APPROVAL_WORKFLOW',
    ];

    for (const f of proFeatures) {
      await prisma.planFeature.upsert({
        where: {
          planId_featureId: {
            planId: professional.id,
            featureId: (await getFeature(f)).id,
          },
        },
        update: {},
        create: {
          planId: professional.id,
          featureId: (await getFeature(f)).id,
          enabled: true,
        },
      });
    }

    await prisma.planFeature.upsert({
      where: {
        planId_featureId: {
          planId: professional.id,
          featureId: (await getFeature('MAX_USERS')).id,
        },
      },
      update: { value: 100 },
      create: {
        planId: professional.id,
        featureId: (await getFeature('MAX_USERS')).id,
        enabled: true,
        value: 100,
      },
    });

    await prisma.planFeature.upsert({
      where: {
        planId_featureId: {
          planId: professional.id,
          featureId: (await getFeature('OCR_MONTHLY_LIMIT')).id,
        },
      },
      update: { value: 500 },
      create: {
        planId: professional.id,
        featureId: (await getFeature('OCR_MONTHLY_LIMIT')).id,
        enabled: true,
        value: 500,
      },
    });

    await prisma.planFeature.upsert({
      where: {
        planId_featureId: {
          planId: professional.id,
          featureId: (await getFeature('DATA_RETENTION_DAYS')).id,
        },
      },
      update: { value: 365 },
      create: {
        planId: professional.id,
        featureId: (await getFeature('DATA_RETENTION_DAYS')).id,
        enabled: true,
        value: 365,
      },
    });
  }

  if (enterprise) {
    const entFeatures = [
      'OCR_RECEIPT_EXTRACTION',
      'AI_RISK_SCORING',
      'ADVANCED_RECONCILIATION',
      'CUSTOM_APPROVAL_WORKFLOW',
      'PRIORITY_SUPPORT',
      'ADVANCED_ANALYTICS',
    ];

    for (const f of entFeatures) {
      await prisma.planFeature.upsert({
        where: {
          planId_featureId: {
            planId: enterprise.id,
            featureId: (await getFeature(f)).id,
          },
        },
        update: { isAddOn: false, addOnPrice: 0, enabled: true },
        create: {
          planId: enterprise.id,
          featureId: (await getFeature(f)).id,
          enabled: true,
        },
      });
    }

    await prisma.planFeature.upsert({
      where: {
        planId_featureId: {
          planId: enterprise.id,
          featureId: (await getFeature('MAX_USERS')).id,
        },
      },
      update: { value: 1000 },
      create: {
        planId: enterprise.id,
        featureId: (await getFeature('MAX_USERS')).id,
        enabled: true,
        value: 1000,
      },
    });

    await prisma.planFeature.upsert({
      where: {
        planId_featureId: {
          planId: enterprise.id,
          featureId: (await getFeature('OCR_MONTHLY_LIMIT')).id,
        },
      },
      update: { value: 5000 },
      create: {
        planId: enterprise.id,
        featureId: (await getFeature('OCR_MONTHLY_LIMIT')).id,
        enabled: true,
        value: 5000,
      },
    });

    await prisma.planFeature.upsert({
      where: {
        planId_featureId: {
          planId: enterprise.id,
          featureId: (await getFeature('DATA_RETENTION_DAYS')).id,
        },
      },
      update: { value: 2555 },
      create: {
        planId: enterprise.id,
        featureId: (await getFeature('DATA_RETENTION_DAYS')).id,
        enabled: true,
        value: 2555,
      },
    });
  }
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

    await seedProductCatalog(prisma);
    console.log('Product catalog seed completed.');
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
