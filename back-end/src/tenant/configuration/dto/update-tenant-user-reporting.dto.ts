import { IsOptional, IsUUID } from 'class-validator';

export class UpdateTenantUserReportingDto {
  @IsOptional() @IsUUID() expectedManagerId?: string | null;
  @IsOptional() @IsUUID() managerId?: string | null;
}
