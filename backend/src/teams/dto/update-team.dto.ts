import { IsOptional, IsArray, IsBoolean } from "class-validator";

export class UpdateTeamDto {
  @IsOptional()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  primaryContactId?: string;

  @IsOptional()
  secondaryContactId?: string;

  @IsOptional()
  @IsArray()
  memberIds?: string[];
}
