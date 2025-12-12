import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateServiceLinkDto } from './dto/create-service-link.dto';
import { UpdateServiceLinkDto } from './dto/update-service-link.dto';

@Injectable()
export class ServiceLinksService {
  constructor(private readonly prisma: PrismaService) {}

  private validateUrl(url: string): void {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new BadRequestException('URL must start with http:// or https://');
    }
  }

  async findByServiceId(serviceId: string) {
    return this.prisma.serviceLink.findMany({
      where: { serviceId },
      orderBy: { type: 'asc' },
    });
  }

  async create(dto: CreateServiceLinkDto) {
    this.validateUrl(dto.url);

    // Check if link type already exists for this service
    const existing = await this.prisma.serviceLink.findFirst({
      where: {
        serviceId: dto.serviceId,
        type: dto.type,
      },
    });

    if (existing) {
      throw new ConflictException(`A ${dto.type} link already exists for this service`);
    }

    return this.prisma.serviceLink.create({
      data: dto,
    });
  }

  async update(id: string, dto: UpdateServiceLinkDto) {
    this.validateUrl(dto.url);

    return this.prisma.serviceLink.update({
      where: { id },
      data: { url: dto.url },
    });
  }

  async delete(id: string) {
    return this.prisma.serviceLink.delete({
      where: { id },
    });
  }
}
