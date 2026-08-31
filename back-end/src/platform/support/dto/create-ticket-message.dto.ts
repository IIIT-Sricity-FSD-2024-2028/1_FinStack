import { IsString, Length, Matches } from 'class-validator';

export class CreateTicketMessageDto {
  @IsString()
  @Length(1, 5000)
  @Matches(/\S/)
  message!: string;
}
