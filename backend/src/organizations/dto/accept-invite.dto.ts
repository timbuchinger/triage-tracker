import { IsNotEmpty, IsString, MinLength, IsOptional } from 'class-validator';

export class AcceptInviteDto {
  @IsNotEmpty()
  @IsString()
  token!: string;

  @IsNotEmpty()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsString()
  name?: string;
}
