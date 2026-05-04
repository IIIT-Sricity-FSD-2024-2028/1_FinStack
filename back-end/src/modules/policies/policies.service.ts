import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PolicyRecord } from '../../data/store';
import { AuditService } from '../audit/audit.service';
import { CategoriesRepository } from '../categories/categories.repository';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { UpdatePolicyDto } from './dto/update-policy.dto';
import { PoliciesRepository } from './policies.repository';

@Injectable()
export class PoliciesService {
  constructor(
    private readonly policiesRepository: PoliciesRepository,
    private readonly categoriesRepository: CategoriesRepository,
    private readonly auditService: AuditService,
  ) {}

  findAll(): PolicyRecord[] {
    return this.policiesRepository.findAll();
  }

  findOne(id: string): PolicyRecord {
    const policy = this.policiesRepository.findById(id);
    if (!policy) throw new NotFoundException('Policy not found.');
    return policy;
  }

  create(dto: CreatePolicyDto): PolicyRecord {
    this.ensureCategory(dto.categoryId, dto.organizationId);
    this.ensureNameUnique(dto.name, dto.organizationId);
    const policy = this.policiesRepository.create({
      name: dto.name,
      categoryId: dto.categoryId,
      maxAmount: dto.maxAmount,
      currency: dto.currency || 'INR',
      approval: dto.approval || 'Manager',
      status: dto.status || 'Active',
      description: dto.description || '',
      requiresApproval: dto.requiresApproval ?? true,
      receiptRequired: dto.receiptRequired ?? true,
      ownerRole: 'configuration_manager',
      organizationId: dto.organizationId,
    });
    this.auditService.record('Created Policy', 'Policy', policy.id, policy.organizationId);
    return policy;
  }

  update(id: string, dto: UpdatePolicyDto): PolicyRecord {
    const current = this.findOne(id);
    const organizationId = dto.organizationId || current.organizationId;
    if (dto.categoryId) this.ensureCategory(dto.categoryId, organizationId);
    if (dto.name && dto.name !== current.name) this.ensureNameUnique(dto.name, organizationId, current.id);
    const updated = this.policiesRepository.update(id, dto);
    if (!updated) throw new NotFoundException('Policy not found.');
    this.auditService.record('Updated Policy', 'Policy', updated.id, updated.organizationId);
    return updated;
  }

  delete(id: string): { id: string; deleted: boolean } {
    const current = this.findOne(id);
    const removed = this.policiesRepository.delete(id);
    if (!removed) throw new NotFoundException('Policy not found.');
    this.auditService.record('Deleted Policy', 'Policy', current.id, current.organizationId);
    return { id: current.id, deleted: true };
  }

  private ensureCategory(categoryId: string, organizationId: string): void {
    const category = this.categoriesRepository.findById(categoryId);
    if (!category || category.organizationId !== organizationId) throw new BadRequestException('Category not found for this organization.');
  }

  private ensureNameUnique(name: string, organizationId: string, ignoreId?: string): void {
    const exists = this.policiesRepository.findAll().some((policy) => policy.id !== ignoreId && policy.organizationId === organizationId && policy.name.toLowerCase() === name.toLowerCase());
    if (exists) throw new BadRequestException('Policy name already exists in this organization.');
  }
}
