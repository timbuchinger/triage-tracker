import { IsString } from 'class-validator';

export class UpdateServiceLinkDto {
  @IsString()
  url!: string;
}
