import { IsOptional, IsUUID } from 'class-validator';

export class UpdateTenantUserReportingDto {
  @IsOptional() @IsUUID() managerId?: string | null;
}
