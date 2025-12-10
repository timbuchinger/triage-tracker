import { IsNotEmpty, IsOptional, IsArray, IsBoolean } from "class-validator";

export class CreateTeamDto {
  @IsNotEmpty({ message: "Name is required" })
  name!: string;

  @IsNotEmpty({ message: "Organization ID is required" })
  organizationId!: string;

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
