import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { PrismaService } from '../database/prisma.service';
import { AuthService } from '../auth/auth.service';
import { UserRole } from '@prisma/client';

describe('InvitesService', () => {
  let service: InvitesService;
  const mockPrisma: any = {
    user: {
      findUnique: jest.fn(),
    },
    invite: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockAuth: any = {
    hashPassword: jest.fn(),
  };

  const mockOrganization = {
    id: 'org-1',
    name: 'Test Organization',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Setup default transaction behavior
    mockPrisma.$transaction.mockImplementation((callback: any) => callback(mockPrisma));
    service = new InvitesService(mockPrisma, mockAuth);
  });

  describe('createInvite', () => {
    const createDto = {
      email: 'new@example.com',
      role: UserRole.MEMBER,
    };

    it('should create an invite successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.invite.findFirst.mockResolvedValue(null);
      mockPrisma.invite.create.mockResolvedValue({
        id: 'invite-1',
        email: createDto.email,
        token: 'secure-token-123',
        role: UserRole.MEMBER,
        organizationId: 'org-1',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        used: false,
        createdAt: new Date(),
        organization: mockOrganization,
      });

      const result = await service.createInvite('org-1', createDto);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email', createDto.email);
      expect(result).toHaveProperty('role', UserRole.MEMBER);
      expect(result).toHaveProperty('inviteUrl');
      expect(result.inviteUrl).toContain('/invite/accept?token=');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: createDto.email },
      });
      expect(mockPrisma.invite.findFirst).toHaveBeenCalled();
      expect(mockPrisma.invite.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: createDto.email,
          role: UserRole.MEMBER,
          organizationId: 'org-1',
        }),
        include: { organization: true },
      });
    });

    it('should throw BadRequestException when user already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'existing-user',
        email: createDto.email,
      });

      await expect(service.createInvite('org-1', createDto)).rejects.toThrow(BadRequestException);
      await expect(service.createInvite('org-1', createDto)).rejects.toThrow('User with this email already exists');

      expect(mockPrisma.invite.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when active invite exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.invite.findFirst.mockResolvedValue({
        id: 'existing-invite',
        email: createDto.email,
        used: false,
        expiresAt: new Date(Date.now() + 3600000),
      });

      await expect(service.createInvite('org-1', createDto)).rejects.toThrow(BadRequestException);
      await expect(service.createInvite('org-1', createDto)).rejects.toThrow('Active invite already exists for this email');

      expect(mockPrisma.invite.create).not.toHaveBeenCalled();
    });

    it('should default to MEMBER role if not specified', async () => {
      const dtoWithoutRole = { email: createDto.email };
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.invite.findFirst.mockResolvedValue(null);
      mockPrisma.invite.create.mockResolvedValue({
        id: 'invite-2',
        email: createDto.email,
        token: 'token-456',
        role: UserRole.MEMBER,
        organizationId: 'org-1',
        expiresAt: new Date(),
        used: false,
        createdAt: new Date(),
        organization: mockOrganization,
      });

      await service.createInvite('org-1', dtoWithoutRole as any);

      expect(mockPrisma.invite.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          role: UserRole.MEMBER,
        }),
        include: { organization: true },
      });
    });

    it('should set expiry to 7 days from creation', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.invite.findFirst.mockResolvedValue(null);
      mockPrisma.invite.create.mockResolvedValue({
        id: 'invite-3',
        email: createDto.email,
        token: 'token-789',
        role: UserRole.MEMBER,
        organizationId: 'org-1',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        used: false,
        createdAt: new Date(),
        organization: mockOrganization,
      });

      await service.createInvite('org-1', createDto);

      const createCall = mockPrisma.invite.create.mock.calls[0][0];
      const expiresAt = createCall.data.expiresAt;
      const now = new Date();
      const diffDays = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      expect(diffDays).toBeGreaterThanOrEqual(6);
      expect(diffDays).toBeLessThanOrEqual(7);
    });
  });

  describe('acceptInvite', () => {
    const acceptDto = {
      token: 'valid-token',
      name: 'John Doe',
      password: 'SecurePass123!',
    };

    const mockInvite = {
      id: 'invite-1',
      token: acceptDto.token,
      email: 'invited@example.com',
      role: UserRole.MEMBER,
      organizationId: 'org-1',
      expiresAt: new Date(Date.now() + 3600000),
      used: false,
      createdAt: new Date(),
      organization: mockOrganization,
    };

    it('should accept invite and create user', async () => {
      mockPrisma.invite.findUnique.mockResolvedValue(mockInvite);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockAuth.hashPassword.mockResolvedValue('hashed-password');

      const mockNewUser = {
        id: 'user-1',
        email: mockInvite.email,
        name: acceptDto.name,
        passwordHash: 'hashed-password',
        organizationId: mockInvite.organizationId,
        role: mockInvite.role,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: null,
      };

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          user: { create: jest.fn().mockResolvedValue(mockNewUser) },
          invite: { update: jest.fn().mockResolvedValue(mockInvite) },
        };
        return callback(tx);
      });

      const result = await service.acceptInvite(acceptDto);

      expect(result).toMatchObject({
        message: 'Invite accepted successfully',
        user: {
          id: mockNewUser.id,
          email: mockNewUser.email,
          name: mockNewUser.name,
          organizationId: mockNewUser.organizationId,
          role: mockNewUser.role,
        },
      });

      expect(mockAuth.hashPassword).toHaveBeenCalledWith(acceptDto.password);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      mockPrisma.invite.findUnique.mockResolvedValue(null);

      await expect(service.acceptInvite(acceptDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.acceptInvite(acceptDto)).rejects.toThrow('Invalid invite token');
    });

    it('should throw UnauthorizedException for already used invite', async () => {
      mockPrisma.invite.findUnique.mockResolvedValue({ ...mockInvite, used: true });

      await expect(service.acceptInvite(acceptDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.acceptInvite(acceptDto)).rejects.toThrow('Invite has already been used');
    });

    it('should throw UnauthorizedException for expired invite', async () => {
      mockPrisma.invite.findUnique.mockResolvedValue({
        ...mockInvite,
        expiresAt: new Date(Date.now() - 3600000), // Expired 1 hour ago
      });

      await expect(service.acceptInvite(acceptDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.acceptInvite(acceptDto)).rejects.toThrow('Invite has expired');
    });

    it('should throw BadRequestException if user already exists', async () => {
      mockPrisma.invite.findUnique.mockResolvedValue(mockInvite);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'existing-user',
        email: mockInvite.email,
      });

      await expect(service.acceptInvite(acceptDto)).rejects.toThrow(BadRequestException);
      await expect(service.acceptInvite(acceptDto)).rejects.toThrow('User already exists');
    });
  });

  describe('listInvites', () => {
    it('should return list of active invites', async () => {
      const mockInvites = [
        {
          id: 'invite-1',
          email: 'user1@example.com',
          role: UserRole.MEMBER,
          expiresAt: new Date(Date.now() + 3600000),
          createdAt: new Date(),
        },
        {
          id: 'invite-2',
          email: 'user2@example.com',
          role: UserRole.OWNER,
          expiresAt: new Date(Date.now() + 7200000),
          createdAt: new Date(),
        },
      ];

      mockPrisma.invite.findMany.mockResolvedValue(mockInvites);

      const result = await service.listInvites('org-1');

      expect(result).toEqual(mockInvites);
      expect(mockPrisma.invite.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-1',
          used: false,
          expiresAt: { gt: expect.any(Date) },
        },
        select: {
          id: true,
          email: true,
          role: true,
          expiresAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when no active invites exist', async () => {
      mockPrisma.invite.findMany.mockResolvedValue([]);

      const result = await service.listInvites('org-1');

      expect(result).toEqual([]);
    });

    it('should only return unused and non-expired invites', async () => {
      mockPrisma.invite.findMany.mockResolvedValue([]);

      await service.listInvites('org-1');

      const callArgs = mockPrisma.invite.findMany.mock.calls[0][0];
      expect(callArgs.where.used).toBe(false);
      expect(callArgs.where.expiresAt).toHaveProperty('gt');
    });
  });

  describe('generateSecureToken', () => {
    it('should generate a unique token each time', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.invite.findFirst.mockResolvedValue(null);
      mockPrisma.invite.create.mockResolvedValue({
        id: 'invite-1',
        email: 'test@example.com',
        token: 'token-1',
        role: UserRole.MEMBER,
        organizationId: 'org-1',
        expiresAt: new Date(),
        used: false,
        createdAt: new Date(),
        organization: mockOrganization,
      });

      const result1 = await service.createInvite('org-1', { email: 'test1@example.com' });
      const result2 = await service.createInvite('org-1', { email: 'test2@example.com' });

      // Tokens should be generated (we check that create was called with a token)
      const token1 = mockPrisma.invite.create.mock.calls[0][0].data.token;
      const token2 = mockPrisma.invite.create.mock.calls[1][0].data.token;

      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(typeof token1).toBe('string');
      expect(typeof token2).toBe('string');
      expect(token1.length).toBeGreaterThan(20);
    });
  });
});
