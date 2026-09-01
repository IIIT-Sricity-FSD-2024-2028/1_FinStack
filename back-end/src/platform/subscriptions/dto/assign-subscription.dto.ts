import { IsUUID } from 'class-validator';

export class AssignSubscriptionDto {
  @IsUUID()
  organizationId!: string;

  @IsUUID()
  planId!: string;
}
