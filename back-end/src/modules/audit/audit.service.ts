import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditRecord } from '../../data/store';
import { CreateAuditDto } from './dto/create-audit.dto';
import { AuditRepository } from './audit.repository';

@Injectable()
export class AuditService {
  constructor(private readonly auditRepository: AuditRepository) {}

  findAll(): AuditRecord[] {
    return this.auditRepository.findAll();
  }

  findOne(id: string): AuditRecord {
    const audit = this.auditRepository.findById(id);
    if (!audit) throw new NotFoundException('Audit log not found.');
    return audit;
  }

  create(dto: CreateAuditDto): AuditRecord {
    return this.auditRepository.create(dto);
  }

  record(action: string, entityType: string, entityId: string, organizationId: string, status: 'Success' | 'Failure' = 'Success'): AuditRecord {
    return this.auditRepository.create({
      userEmployeeId: 'system',
      organizationId,
      userRoleId: 'system',
      userRole: 'System',
      action,
      entityType,
      entityId,
      entityName: entityId,
      status,
    });
  }
}
