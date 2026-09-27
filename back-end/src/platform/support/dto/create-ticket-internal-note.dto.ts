import { IsString, Length, Matches } from 'class-validator';

export class CreateTicketInternalNoteDto {
  @IsString()
  @Length(1, 5000)
  @Matches(/\S/)
  note!: string;
}
