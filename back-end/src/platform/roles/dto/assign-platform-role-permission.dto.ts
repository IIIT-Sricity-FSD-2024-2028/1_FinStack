import { IsUUID } from 'class-validator';

export class AssignPlatformRolePermissionDto {
  @IsUUID()
  permissionId: string;
}
