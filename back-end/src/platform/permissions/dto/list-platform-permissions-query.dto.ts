import { IsOptional, IsString } from 'class-validator';

export class ListPlatformPermissionsQueryDto {
  @IsOptional()
  @IsString()
  search?: string;
}
