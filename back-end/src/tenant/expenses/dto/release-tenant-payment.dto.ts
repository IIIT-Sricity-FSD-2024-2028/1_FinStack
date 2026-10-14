import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, ArrayMaxSize, IsArray, IsUUID } from 'class-validator';

export class ReleaseTenantPaymentDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(100)
  expenseIds: string[];
}
