import { IsOptional, IsEnum, IsString } from "class-validator";
import { Severity } from "@prisma/client";

export class UpdateIncidentDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(Severity)
  severity?: Severity;

  @IsOptional()
  @IsString()
  serviceId?: string;

  @IsOptional()
  @IsString()
  internalNotes?: string;
}