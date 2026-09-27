import { IsUUID } from 'class-validator';

export class AssignPlatformStaffRoleDto {
  @IsUUID()
  roleId: string;
}
