import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRecord } from '../../data/store';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly auditService: AuditService,
  ) {}

  findAll(): UserRecord[] {
    return this.usersRepository.findAll();
  }

  findOne(id: string): UserRecord {
    const user = this.usersRepository.findById(id);
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  create(dto: CreateUserDto): UserRecord {
    this.ensureUnique(dto.employeeId, dto.email, dto.organizationId);
    if (dto.managerEmployeeId) this.ensureManagerExists(dto.managerEmployeeId);

    const user = this.usersRepository.create({
      employeeId: dto.employeeId,
      fullName: dto.fullName,
      email: dto.email,
      department: dto.department || 'General',
      phone: dto.phone || '',
      location: dto.location || 'India',
      roles: dto.roles,
      managerEmployeeId: dto.managerEmployeeId || '',
      status: dto.status || 'Active',
      accountStatus: dto.accountStatus || 'approved',
      organizationId: dto.organizationId,
      password: dto.password || 'FinStack@123',
      firstLoginRequired: dto.firstLoginRequired ?? true,
    });
    this.auditService.record('Created User', 'User', user.employeeId, user.organizationId);
    return user;
  }

  update(id: string, dto: UpdateUserDto): UserRecord {
    const current = this.findOne(id);
    if (dto.email && dto.email.toLowerCase() !== current.email.toLowerCase()) {
      this.ensureEmailUnique(dto.email, current.organizationId, current.employeeId);
    }
    if (dto.employeeId && dto.employeeId !== current.employeeId) {
      this.ensureEmployeeIdUnique(dto.employeeId, current.organizationId);
    }
    if (dto.managerEmployeeId) this.ensureManagerExists(dto.managerEmployeeId);

    const updated = this.usersRepository.update(id, dto);
    if (!updated) throw new NotFoundException('User not found.');
    this.auditService.record('Updated User', 'User', updated.employeeId, updated.organizationId);
    return updated;
  }

  delete(id: string): { id: string; deleted: boolean } {
    const current = this.findOne(id);
    const removed = this.usersRepository.delete(id);
    if (!removed) throw new NotFoundException('User not found.');
    this.auditService.record('Deleted User', 'User', current.employeeId, current.organizationId);
    return { id: current.id, deleted: true };
  }

  private ensureUnique(employeeId: string, email: string, organizationId: string): void {
    this.ensureEmployeeIdUnique(employeeId, organizationId);
    this.ensureEmailUnique(email, organizationId);
  }

  private ensureEmployeeIdUnique(employeeId: string, organizationId: string): void {
    const exists = this.usersRepository.findAll().some((user) => user.employeeId === employeeId && user.organizationId === organizationId);
    if (exists) throw new BadRequestException('Employee ID already exists in this organization.');
  }

  private ensureEmailUnique(email: string, organizationId: string, ignoreEmployeeId?: string): void {
    const exists = this.usersRepository.findAll().some((user) => user.employeeId !== ignoreEmployeeId && user.organizationId === organizationId && user.email.toLowerCase() === email.toLowerCase());
    if (exists) throw new BadRequestException('Email address already exists in this organization.');
  }

  private ensureManagerExists(employeeId: string): void {
    const manager = this.usersRepository.findById(employeeId);
    if (!manager) throw new BadRequestException('Manager user not found.');
  }
}
