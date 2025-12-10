import { EventType, Prisma } from "@prisma/client";

export class AddEventDto {
  type!: EventType;
  timestamp?: Date | string;
  message?: string;
  slackTs?: string;
  slackUser?: string;
  metadata?: Prisma.InputJsonValue;
}
