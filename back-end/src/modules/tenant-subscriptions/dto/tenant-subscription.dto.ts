import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class TenantCreateSubscriptionDto {
  @ApiProperty({ description: 'Plan ID' })
  @IsUUID()
  @IsNotEmpty()
  planId!: string;
}

export class TenantUpdateSubscriptionDto {
  @ApiProperty({ description: 'New Plan ID' })
  @IsUUID()
  @IsNotEmpty()
  planId!: string;
}
