import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { CreateServiceDto } from "./dto/create-service.dto";

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.service.findMany({
      include: {
        team: {
          select: {
            id: true,
            name: true,
            isDefault: true,
            primaryContact: { select: { id: true, name: true, email: true } },
            secondaryContact: { select: { id: true, name: true, email: true } }
          }
        }
      },
      orderBy: { name: "asc" }
    });
  }

  async create(dto: CreateServiceDto) {
    // For now, assume organizationId is hardcoded or from context
    // TODO: Get from user context
    // Use the seeded default organization id in dev: 'org_default'
    const organizationId = "org_default"; // Placeholder

    return this.prisma.service.create({
      data: {
        name: dto.name,
        organizationId,
        teamId: dto.teamId
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            isDefault: true,
            primaryContact: { select: { id: true, name: true, email: true } },
            secondaryContact: { select: { id: true, name: true, email: true } }
          }
        }
      }
    });
  }

  delete(id: string) {
    return this.prisma.service.delete({
      where: { id }
    });
  }
}