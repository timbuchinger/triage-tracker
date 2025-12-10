import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { PrismaService } from '../database/prisma.service';
import { UserRole } from '@prisma/client';

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  const mockPrisma: any = {
    user: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    role: UserRole.MEMBER,
    organizationId: 'org-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLogin: null,
  };

  const mockOwner = {
    id: 'owner-1',
    email: 'owner@example.com',
    name: 'Owner User',
    role: UserRole.OWNER,
    organizationId: 'org-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLogin: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    service = new OrganizationsService(mockPrisma);
  });

  describe('getMembers', () => {
    it('should return all members of an organization', async () => {
      const members = [mockOwner, mockUser];
      mockPrisma.user.findMany.mockResolvedValue(members);

      const result = await service.getMembers('org-1');

      expect(result).toEqual(members);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          lastLogin: true,
        },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      });
    });

    it('should return empty array when organization has no members', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await service.getMembers('org-empty');

      expect(result).toEqual([]);
    });

    it('should order members with OWNER role first', async () => {
      const members = [mockOwner, mockUser];
      mockPrisma.user.findMany.mockResolvedValue(members);

      await service.getMembers('org-1');

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        })
      );
    });
  });

  describe('updateMemberRole', () => {
    const updateDto = { role: UserRole.MEMBER };

    it('should update member role successfully', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.user.count.mockResolvedValue(2);
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, role: UserRole.MEMBER });

      const result = await service.updateMemberRole('org-1', 'user-1', updateDto, 'current-user');

      expect(result.role).toBe(UserRole.MEMBER);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { role: UserRole.MEMBER },
        select: expect.any(Object),
      });
    });

    it('should throw NotFoundException when user is not in organization', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.updateMemberRole('org-1', 'nonexistent', updateDto, 'current-user')
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.updateMemberRole('org-1', 'nonexistent', updateDto, 'current-user')
      ).rejects.toThrow('User not found in organization');
    });

    it('should throw ForbiddenException when user tries to change their own role', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      await expect(
        service.updateMemberRole('org-1', 'user-1', updateDto, 'user-1')
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.updateMemberRole('org-1', 'user-1', updateDto, 'user-1')
      ).rejects.toThrow('Cannot change your own role');
    });

    it('should throw BadRequestException when removing last owner', async () => {
      const demoteDto = { role: UserRole.MEMBER };
      mockPrisma.user.findFirst.mockResolvedValue(mockOwner);
      mockPrisma.user.count.mockResolvedValue(1);

      await expect(
        service.updateMemberRole('org-1', 'owner-1', demoteDto, 'current-user')
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateMemberRole('org-1', 'owner-1', demoteDto, 'current-user')
      ).rejects.toThrow('Cannot remove the last owner');
    });

    it('should allow demoting owner when multiple owners exist', async () => {
      const demoteDto = { role: UserRole.MEMBER };
      mockPrisma.user.findFirst.mockResolvedValue(mockOwner);
      mockPrisma.user.count.mockResolvedValue(2);
      mockPrisma.user.update.mockResolvedValue({ ...mockOwner, role: UserRole.MEMBER });

      const result = await service.updateMemberRole('org-1', 'owner-1', demoteDto, 'current-user');

      expect(result.role).toBe(UserRole.MEMBER);
      expect(mockPrisma.user.count).toHaveBeenCalledWith({
        where: { organizationId: 'org-1', role: UserRole.OWNER },
      });
    });

    it('should allow promoting member to owner', async () => {
      const promoteDto = { role: UserRole.OWNER };
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, role: UserRole.OWNER });

      const result = await service.updateMemberRole('org-1', 'user-1', promoteDto, 'current-user');

      expect(result.role).toBe(UserRole.OWNER);
      expect(mockPrisma.user.count).not.toHaveBeenCalled();
    });

    it('should not check owner count when not changing from OWNER role', async () => {
      const updateToAdmin = { role: UserRole.MEMBER };
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, role: UserRole.MEMBER });

      await service.updateMemberRole('org-1', 'user-1', updateToAdmin, 'current-user');

      expect(mockPrisma.user.count).not.toHaveBeenCalled();
    });
  });

  describe('removeMember', () => {
    it('should remove a member successfully', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.user.count.mockResolvedValue(2);
      mockPrisma.user.delete.mockResolvedValue(mockUser);

      const result = await service.removeMember('org-1', 'user-1', 'current-user');

      expect(result).toEqual({ message: 'Member removed successfully' });
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    });

    it('should throw NotFoundException when user is not in organization', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.removeMember('org-1', 'nonexistent', 'current-user')
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.removeMember('org-1', 'nonexistent', 'current-user')
      ).rejects.toThrow('User not found in organization');
    });

    it('should throw ForbiddenException when user tries to remove themselves', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      await expect(
        service.removeMember('org-1', 'user-1', 'user-1')
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.removeMember('org-1', 'user-1', 'user-1')
      ).rejects.toThrow('Cannot remove yourself');
    });

    it('should throw BadRequestException when removing last owner', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockOwner);
      mockPrisma.user.count.mockResolvedValue(1);

      await expect(
        service.removeMember('org-1', 'owner-1', 'current-user')
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.removeMember('org-1', 'owner-1', 'current-user')
      ).rejects.toThrow('Cannot remove the last owner');
    });

    it('should allow removing owner when multiple owners exist', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockOwner);
      mockPrisma.user.count.mockResolvedValue(2);
      mockPrisma.user.delete.mockResolvedValue(mockOwner);

      const result = await service.removeMember('org-1', 'owner-1', 'current-user');

      expect(result).toEqual({ message: 'Member removed successfully' });
      expect(mockPrisma.user.count).toHaveBeenCalledWith({
        where: { organizationId: 'org-1', role: UserRole.OWNER },
      });
    });

    it('should not check owner count when removing non-owner member', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.user.delete.mockResolvedValue(mockUser);

      await service.removeMember('org-1', 'user-1', 'current-user');

      expect(mockPrisma.user.count).not.toHaveBeenCalled();
    });
  });
});
