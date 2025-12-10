import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateSummaryDto {
  @IsString()
  @IsNotEmpty()
  content!: string;
}
