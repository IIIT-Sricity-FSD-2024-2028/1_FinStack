import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CategoryRecord } from '../../data/store';
import { AuditService } from '../audit/audit.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoriesRepository } from './categories.repository';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly categoriesRepository: CategoriesRepository,
    private readonly auditService: AuditService,
  ) {}

  findAll(): CategoryRecord[] {
    return this.categoriesRepository.findAll();
  }

  findOne(id: string): CategoryRecord {
    const category = this.categoriesRepository.findById(id);
    if (!category) throw new NotFoundException('Category not found.');
    return category;
  }

  create(dto: CreateCategoryDto): CategoryRecord {
    this.ensureNameUnique(dto.name, dto.organizationId);
    const category = this.categoriesRepository.create({
      name: dto.name,
      description: dto.description || '',
      limit: dto.limit,
      currency: dto.currency || 'INR',
      status: dto.status || 'Active',
      organizationId: dto.organizationId,
      requiresReceipt: dto.requiresReceipt ?? true,
      color: dto.color || '#2563EB',
    });
    this.auditService.record('Created Category', 'Category', category.id, category.organizationId);
    return category;
  }

  update(id: string, dto: UpdateCategoryDto): CategoryRecord {
    const current = this.findOne(id);
    if (dto.name && dto.name !== current.name) this.ensureNameUnique(dto.name, dto.organizationId || current.organizationId, current.id);
    const updated = this.categoriesRepository.update(id, dto);
    if (!updated) throw new NotFoundException('Category not found.');
    this.auditService.record('Updated Category', 'Category', updated.id, updated.organizationId);
    return updated;
  }

  delete(id: string): { id: string; deleted: boolean } {
    const current = this.findOne(id);
    const removed = this.categoriesRepository.delete(id);
    if (!removed) throw new NotFoundException('Category not found.');
    this.auditService.record('Deleted Category', 'Category', current.id, current.organizationId);
    return { id: current.id, deleted: true };
  }

  private ensureNameUnique(name: string, organizationId: string, ignoreId?: string): void {
    const exists = this.categoriesRepository.findAll().some((category) => category.id !== ignoreId && category.organizationId === organizationId && category.name.toLowerCase() === name.toLowerCase());
    if (exists) throw new BadRequestException('Category name already exists in this organization.');
  }
}
