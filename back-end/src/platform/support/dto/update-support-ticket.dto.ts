import { TicketCategory, TicketPriority } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateSupportTicketDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  @Matches(/\S/)
  requesterName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  requesterEmail?: string;

  @IsOptional()
  @IsEnum(TicketCategory)
  category?: TicketCategory;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsString()
  @Length(3, 200)
  @Matches(/\S/)
  subject?: string;

  @IsOptional()
  @IsString()
  @Length(1, 5000)
  @Matches(/\S/)
  description?: string;
}
