import { Prisma } from "@prisma/client";

export class AddSummaryDto {
  content!: string;
  metadata?: Prisma.InputJsonValue;
}
