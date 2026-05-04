import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationRecord } from '../../data/store';
import { AuditService } from '../audit/audit.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationsRepository } from './notifications.repository';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly auditService: AuditService,
  ) {}

  findAll(): NotificationRecord[] {
    return this.notificationsRepository.findAll();
  }

  findOne(id: string): NotificationRecord {
    const notification = this.notificationsRepository.findById(id);
    if (!notification) throw new NotFoundException('Notification not found.');
    return notification;
  }

  create(dto: CreateNotificationDto): NotificationRecord {
    const notification = this.createSystem(dto);
    this.auditService.record('Created Notification', 'Notification', notification.id, 'system');
    return notification;
  }

  createSystem(dto: CreateNotificationDto): NotificationRecord {
    return this.notificationsRepository.create({
      unread: dto.unread ?? true,
      type: dto.type || 'info',
      recipientEmployeeId: dto.recipientEmployeeId || '',
      recipientRole: dto.recipientRole || '',
      title: dto.title,
      message: dto.message,
      relatedExpenseId: dto.relatedExpenseId || '',
      relatedEntityId: dto.relatedEntityId || '',
      actionType: dto.actionType || '',
      dedupeKey: dto.dedupeKey || [dto.actionType || dto.title, dto.relatedExpenseId || dto.relatedEntityId || dto.message, dto.recipientRole || '', dto.recipientEmployeeId || ''].join('|'),
    });
  }

  update(id: string, dto: Partial<CreateNotificationDto>): NotificationRecord {
    this.findOne(id);
    const updated = this.notificationsRepository.update(id, dto);
    if (!updated) throw new NotFoundException('Notification not found.');
    this.auditService.record('Updated Notification', 'Notification', updated.id, 'system');
    return updated;
  }

  delete(id: string): { id: string; deleted: boolean } {
    const current = this.findOne(id);
    const removed = this.notificationsRepository.delete(id);
    if (!removed) throw new NotFoundException('Notification not found.');
    this.auditService.record('Deleted Notification', 'Notification', current.id, 'system');
    return { id: current.id, deleted: true };
  }
}
