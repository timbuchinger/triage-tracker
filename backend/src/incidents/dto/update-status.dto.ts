import { IsEnum, IsOptional, IsString } from "class-validator";
import { Status } from "@prisma/client";

export class UpdateStatusDto {
  @IsEnum(Status)
  status!: Status;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  timestamp?: string;

  @IsOptional()
  metadata?: unknown;
}
