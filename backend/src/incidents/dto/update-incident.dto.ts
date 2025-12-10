import { Severity } from "@prisma/client";

export class UpdateIncidentDto {
  title?: string;
  description?: string;
  severity?: Severity;
  serviceId?: string;
}