import { appendAudit } from '../audit/tenant-audit-write';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  CATEGORY_TEMPLATES,
  CONFIGURATION_CATALOG,
  POLICY_TEMPLATES,
} from './configuration-template-catalog';
import {
  ActivateCategoryTemplatesDto,
  ActivatePolicyTemplatesDto,
} from './dto/activate-configuration-templates.dto';

@Injectable()
export class ConfigurationTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async catalog(organizationId: string) {
    const organization = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { defaultCurrency: true },
    });
    return {
      ...CONFIGURATION_CATALOG,
      defaultCurrency: organization.defaultCurrency,
    };
  }

  async activateCategories(
    organizationId: string,
    dto: ActivateCategoryTemplatesDto,
  ) {
    const templates = dto.templateKeys.map((key) => {
      const template = CATEGORY_TEMPLATES.find((item) => item.key === key);
      if (!template)
        throw new BadRequestException(
          'Unknown category template. Reload the catalog.',
        );
      return template;
    });
    return this.prisma.$transaction(async (tx) => {
      // Match the organization lock used by audited category CRUD so the
      // created/skipped breakdown cannot mislabel a concurrent manual create.
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${organizationId}::uuid FOR UPDATE`;
      // Keep batch ordering stable; the database unique indexes remain the
      // final guard for direct writers and case-insensitive name conflicts.
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${organizationId + ':configuration-templates'}))`;
      const org = await tx.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { defaultCurrency: true },
      });
      const existingBefore = await tx.expenseCategory.findMany({
        where: {
          organizationId,
          OR: [
            { templateKey: { in: templates.map((item) => item.key) } },
            {
              name: {
                in: templates.map((item) => item.name),
                mode: 'insensitive',
              },
            },
          ],
        },
        select: { id: true, templateKey: true, name: true, status: true },
      });
      const existingIds = new Set(existingBefore.map((item) => item.id));
      const result = await tx.expenseCategory.createMany({
        data: templates.map((item) => ({
          organizationId,
          templateKey: item.key,
          name: item.name,
          description: item.description,
          color: item.color,
          currency: org.defaultCurrency,
        })),
        skipDuplicates: true,
      });
      const existingAfter = await tx.expenseCategory.findMany({
        where: {
          organizationId,
          OR: [
            { templateKey: { in: templates.map((item) => item.key) } },
            {
              name: {
                in: templates.map((item) => item.name),
                mode: 'insensitive',
              },
            },
          ],
        },
        select: { id: true, templateKey: true, name: true, status: true },
      });
      const selectedResults = templates.map((template) => {
        const existing = existingAfter.find(
          (item) =>
            item.templateKey === template.key ||
            item.name.trim().toLowerCase() === template.name.toLowerCase(),
        );
        const created = Boolean(existing && !existingIds.has(existing.id));
        return {
          key: template.key,
          name: template.name,
          status: existing?.status || null,
          created,
        };
      });
      const createdTemplates = selectedResults
        .filter((item) => item.created)
        .map(({ key, name }) => ({ key, name }));
      const skippedTemplates = selectedResults
        .filter((item) => !item.created)
        .map(({ key, name, status }) => ({ key, name, status }));
      await appendAudit(
        tx,
        organizationId,
        'category.templates_activated',
        'category_batch',
        organizationId,
        {
          templateKeys: dto.templateKeys,
          createdCount: result.count,
          existingCount: templates.length - result.count,
          createdKeys: createdTemplates.map((item) => item.key),
          skippedKeys: skippedTemplates.map((item) => item.key),
        },
      );
      return {
        createdCount: result.count,
        existingCount: templates.length - result.count,
        createdTemplates,
        skippedTemplates,
      };
    });
  }

  async activatePolicies(
    organizationId: string,
    dto: ActivatePolicyTemplatesDto,
  ) {
    const templates = dto.policies.map((selection) => {
      const template = POLICY_TEMPLATES.find(
        (item) => item.key === selection.templateKey,
      );
      if (!template)
        throw new BadRequestException(
          'Unknown policy template. Reload the catalog.',
        );
      return { template, selection };
    });
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${organizationId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${organizationId + ':configuration-templates'}))`;
      const categories = await tx.expenseCategory.findMany({
        where: {
          organizationId,
          id: { in: dto.policies.map((item) => item.categoryId) },
        },
      });
      for (const { template, selection } of templates) {
        const category = categories.find(
          (item) => item.id === selection.categoryId,
        );
        const categoryTemplate = CATEGORY_TEMPLATES.find(
          (item) => item.key === template.categoryKey,
        )!;
        if (
          !category ||
          category.status !== 'Active' ||
          !(
            category.templateKey === template.categoryKey ||
            (!category.templateKey &&
              category.name.trim().toLowerCase() ===
                categoryTemplate.name.toLowerCase())
          )
        ) {
          throw new BadRequestException(
            'Select the active matching category in your organization. Activate categories first.',
          );
        }
      }
      const previous = await tx.expensePolicy.findMany({
        where: {
          organizationId,
          OR: [
            {
              templateKey: {
                in: templates.map(({ template }) => template.key),
              },
            },
            {
              name: {
                in: templates.map(({ template }) => template.name),
                mode: 'insensitive',
              },
            },
          ],
        },
        select: { id: true, templateKey: true, name: true, status: true },
      });
      const result = await tx.expensePolicy.createMany({
        data: templates.map(({ template, selection }) => ({
          organizationId,
          templateKey: template.key,
          name: template.name,
          description: template.description,
          categoryId: selection.categoryId,
          maxAmount: selection.maxAmount,
          currency: selection.currency,
          receiptRequired: selection.receiptRequired,
          requiresApproval: selection.approvalLevels > 0,
          approval: CONFIGURATION_CATALOG.approvalOptions.find(
            (option) => option.levels === selection.approvalLevels,
          )!.label,
        })),
        skipDuplicates: true,
      });
      await appendAudit(
        tx,
        organizationId,
        'policy.templates_activated',
        'policy_batch',
        organizationId,
        {
          policies: dto.policies.map((p) => ({
            templateKey: p.templateKey,
            categoryId: p.categoryId,
            maxAmount: new Prisma.Decimal(p.maxAmount).toFixed(2),
            currency: p.currency,
            approvalLevels: p.approvalLevels,
            receiptRequired: p.receiptRequired,
          })),
          createdCount: result.count,
          existingCount: templates.length - result.count,
        },
      );
      return {
        createdCount: result.count,
        existingCount: templates.length - result.count,
        skippedTemplates: templates.flatMap(({ template }) => {
          const record = previous.find(
            (row) =>
              row.templateKey === template.key ||
              row.name.toLowerCase() === template.name.toLowerCase(),
          );
          return record
            ? [{ key: template.key, name: record.name, status: record.status }]
            : [];
        }),
      };
    });
  }
}
