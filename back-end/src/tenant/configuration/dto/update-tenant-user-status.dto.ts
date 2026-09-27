import { IsEnum } from 'class-validator';
import { TenantUserStatus } from '@prisma/client';

export class UpdateTenantUserStatusDto {
  @IsEnum(TenantUserStatus) status!: TenantUserStatus;
}
