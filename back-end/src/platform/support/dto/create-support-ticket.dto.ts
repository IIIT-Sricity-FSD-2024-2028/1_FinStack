import { TicketCategory, TicketPriority } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateSupportTicketDto {
  @IsUUID()
  organizationId!: string;

  @IsOptional()
  @IsUUID()
  requesterUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  @Matches(/\S/)
  requesterName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  requesterEmail?: string;

  @IsEnum(TicketCategory)
  category!: TicketCategory;

  @IsEnum(TicketPriority)
  priority!: TicketPriority;

  @IsString()
  @Length(3, 200)
  @Matches(/\S/)
  subject!: string;

  @IsString()
  @Length(1, 5000)
  @Matches(/\S/)
  description!: string;
}
