import { ServiceLinksService } from './service-links.service';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { ServiceLinkType } from '@prisma/client';

describe('ServiceLinksService', () => {
  const mockPrisma: any = {
    serviceLink: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const svc = new ServiceLinksService(mockPrisma as any);

  beforeEach(() => jest.clearAllMocks());

  describe('findByServiceId', () => {
    it('should return all links for a service ordered by type', async () => {
      const mockLinks = [
        { id: 'l1', serviceId: 's1', type: 'GIT', url: 'https://git.com' },
        { id: 'l2', serviceId: 's1', type: 'GRAFANA', url: 'https://grafana.com' },
      ];
      mockPrisma.serviceLink.findMany.mockResolvedValue(mockLinks);

      const result = await svc.findByServiceId('s1');

      expect(result).toEqual(mockLinks);
      expect(mockPrisma.serviceLink.findMany).toHaveBeenCalledWith({
        where: { serviceId: 's1' },
        orderBy: { type: 'asc' },
      });
    });
  });

  describe('create', () => {
    it('should create a service link successfully', async () => {
      const dto = { serviceId: 's1', type: ServiceLinkType.GRAFANA, url: 'https://grafana.com' };
      const mockLink = { id: 'l1', ...dto };

      mockPrisma.serviceLink.findFirst.mockResolvedValue(null);
      mockPrisma.serviceLink.create.mockResolvedValue(mockLink);

      const result = await svc.create(dto);

      expect(result).toEqual(mockLink);
      expect(mockPrisma.serviceLink.findFirst).toHaveBeenCalledWith({
        where: { serviceId: 's1', type: ServiceLinkType.GRAFANA },
      });
      expect(mockPrisma.serviceLink.create).toHaveBeenCalledWith({
        data: dto,
      });
    });

    it('should throw BadRequestException for invalid URL without http/https', async () => {
      const dto = { serviceId: 's1', type: ServiceLinkType.GRAFANA, url: 'grafana.com' };

      await expect(svc.create(dto)).rejects.toThrow(BadRequestException);
      await expect(svc.create(dto)).rejects.toThrow('URL must start with http:// or https://');
    });

    it('should throw ConflictException when link type already exists for service', async () => {
      const dto = { serviceId: 's1', type: ServiceLinkType.GRAFANA, url: 'https://grafana.com' };
      mockPrisma.serviceLink.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(svc.create(dto)).rejects.toThrow(ConflictException);
      await expect(svc.create(dto)).rejects.toThrow('A GRAFANA link already exists for this service');
    });

    it('should accept http:// URLs', async () => {
      const dto = { serviceId: 's1', type: ServiceLinkType.GIT, url: 'http://git.internal' };
      mockPrisma.serviceLink.findFirst.mockResolvedValue(null);
      mockPrisma.serviceLink.create.mockResolvedValue({ id: 'l1', ...dto });

      const result = await svc.create(dto);

      expect(result.url).toBe('http://git.internal');
    });
  });

  describe('update', () => {
    it('should update a service link URL', async () => {
      const updated = { id: 'l1', serviceId: 's1', type: 'GRAFANA', url: 'https://new-grafana.com' };
      mockPrisma.serviceLink.update.mockResolvedValue(updated);

      const result = await svc.update('l1', { url: 'https://new-grafana.com' });

      expect(result).toEqual(updated);
      expect(mockPrisma.serviceLink.update).toHaveBeenCalledWith({
        where: { id: 'l1' },
        data: { url: 'https://new-grafana.com' },
      });
    });

    it('should throw BadRequestException for invalid URL', async () => {
      await expect(svc.update('l1', { url: 'invalid' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('delete', () => {
    it('should delete a service link', async () => {
      mockPrisma.serviceLink.delete.mockResolvedValue({});

      await svc.delete('l1');

      expect(mockPrisma.serviceLink.delete).toHaveBeenCalledWith({
        where: { id: 'l1' },
      });
    });
  });
});
