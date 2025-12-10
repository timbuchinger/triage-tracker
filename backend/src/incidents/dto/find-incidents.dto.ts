import { IsOptional, IsEnum, IsArray } from "class-validator";
import { Transform } from "class-transformer";
import { Status } from "@prisma/client";

export class FindIncidentsDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    return Array.isArray(value) ? value : [value];
  })
  @IsArray()
  @IsEnum(Status, { each: true })
  status?: Status[];

  @IsOptional()
  @IsEnum(["7", "30", "90", "all"] as any)
  dateRange?: "7" | "30" | "90" | "all";

  @IsOptional()
  @IsEnum(["me", "everyone"] as any)
  owner?: "me" | "everyone";

  // optional helper for tests/dev; when auth not wired callers can pass userId
  @IsOptional()
  userId?: string;
}
