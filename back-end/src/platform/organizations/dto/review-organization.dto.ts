import { IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
export class ReviewOrganizationDto {
  @IsIn(['APPROVED', 'REJECTED']) decision!: 'APPROVED' | 'REJECTED';
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  @Matches(/^(?:[^\p{Cc}\p{Cf}<>]|[\n\r\t])+$/u)
  note!: string;
}
