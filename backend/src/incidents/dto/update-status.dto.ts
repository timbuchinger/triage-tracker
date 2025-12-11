import { IsEnum, IsOptional, IsString } from "class-validator";
import { Status, Prisma } from "@prisma/client";

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
  metadata?: Prisma.InputJsonValue;
}
