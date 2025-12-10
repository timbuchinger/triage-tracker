import { IsNotEmpty, IsOptional, IsEnum } from "class-validator";
import { Severity } from "@prisma/client";

export class CreateIncidentDto {
  @IsNotEmpty({ message: "Title is required" })
  title!: string;

  @IsOptional()
  description?: string;

  @IsOptional()
  @IsEnum(Severity)
  severity?: Severity;

  @IsOptional()
  serviceId?: string;

  @IsOptional()
  reporterId?: string;
}
