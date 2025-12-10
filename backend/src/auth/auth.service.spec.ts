import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../database/prisma.service';
import { UserRole } from '@prisma/client';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  const mockPrisma: any = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const mockJwt: any = {
    sign: jest.fn(),
  };

  const mockConfig: any = {
    get: jest.fn(),
  };

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    passwordHash: 'hashedPassword',
    organizationId: 'org-1',
    role: UserRole.MEMBER,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLogin: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    service = new AuthService(mockPrisma, mockJwt, mockConfig);
  });

  describe('validateUser', () => {
    it('should return user when credentials are valid', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('test@example.com', 'password123');

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        include: { organization: true },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashedPassword');
    });

    it('should return null when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.validateUser('nonexistent@example.com', 'password123');

      expect(result).toBeNull();
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should return null when user has no password hash', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, passwordHash: null });

      const result = await service.validateUser('test@example.com', 'password123');

      expect(result).toBeNull();
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should return null when password is invalid', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser('test@example.com', 'wrongpassword');

      expect(result).toBeNull();
      expect(bcrypt.compare).toHaveBeenCalledWith('wrongpassword', 'hashedPassword');
    });
  });

  describe('login', () => {
    it('should generate tokens and update lastLogin', async () => {
      const accessToken = 'access-token-123';
      const refreshToken = 'refresh-token-123';

      mockJwt.sign.mockReturnValue(accessToken);
      mockConfig.get.mockReturnValue('7d');
      mockPrisma.refreshToken.create.mockResolvedValue({
        id: 'token-1',
        token: refreshToken,
        userId: mockUser.id,
        expiresAt: new Date(),
        revoked: false,
        createdAt: new Date(),
      });
      mockPrisma.user.update.mockResolvedValue(mockUser);

      const result = await service.login(mockUser);

      expect(result).toMatchObject({
        accessToken,
        refreshToken: expect.any(String),
        user: {
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
          organizationId: mockUser.organizationId,
          role: mockUser.role,
        },
      });

      expect(mockJwt.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        organizationId: mockUser.organizationId,
        role: mockUser.role,
      });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { lastLogin: expect.any(Date) },
      });
    });

    it('should throw UnauthorizedException when user has no organizationId', async () => {
      const userWithoutOrg: any = { ...mockUser, organizationId: null };

      await expect(service.login(userWithoutOrg)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(userWithoutOrg)).rejects.toThrow('User must belong to an organization');
    });
  });

  describe('refresh', () => {
    const validToken = 'valid-refresh-token';
    const mockTokenRecord = {
      id: 'token-1',
      token: validToken,
      userId: mockUser.id,
      expiresAt: new Date(Date.now() + 86400000), // tomorrow
      revoked: false,
      createdAt: new Date(),
      user: mockUser,
    };

    it('should generate new tokens when refresh token is valid', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(mockTokenRecord);
      mockPrisma.refreshToken.update.mockResolvedValue({ ...mockTokenRecord, revoked: true });
      mockJwt.sign.mockReturnValue('new-access-token');
      mockConfig.get.mockReturnValue('7d');
      mockPrisma.refreshToken.create.mockResolvedValue({
        id: 'token-2',
        token: 'new-refresh-token',
        userId: mockUser.id,
        expiresAt: new Date(),
        revoked: false,
        createdAt: new Date(),
      });
      mockPrisma.user.update.mockResolvedValue(mockUser);

      const result = await service.refresh(validToken);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: mockTokenRecord.id },
        data: { revoked: true },
      });
    });

    it('should throw UnauthorizedException when token does not exist', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh('invalid-token')).rejects.toThrow(UnauthorizedException);
      await expect(service.refresh('invalid-token')).rejects.toThrow('Invalid or expired refresh token');
    });

    it('should throw UnauthorizedException when token is revoked', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({ ...mockTokenRecord, revoked: true });

      await expect(service.refresh(validToken)).rejects.toThrow(UnauthorizedException);
      await expect(service.refresh(validToken)).rejects.toThrow('Invalid or expired refresh token');
    });

    it('should throw UnauthorizedException when token is expired', async () => {
      const expiredToken = {
        ...mockTokenRecord,
        expiresAt: new Date(Date.now() - 86400000), // yesterday
      };
      mockPrisma.refreshToken.findUnique.mockResolvedValue(expiredToken);

      await expect(service.refresh(validToken)).rejects.toThrow(UnauthorizedException);
      await expect(service.refresh(validToken)).rejects.toThrow('Invalid or expired refresh token');
    });
  });

  describe('logout', () => {
    it('should revoke refresh token', async () => {
      const token = 'refresh-token-to-revoke';
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await service.logout(token);

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { token },
        data: { revoked: true },
      });
    });

    it('should handle logout when token does not exist', async () => {
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.logout('nonexistent-token')).resolves.toBeUndefined();
    });
  });

  describe('createRefreshToken', () => {
    it('should create a refresh token with default expiry', async () => {
      const userId = 'user-1';
      mockConfig.get.mockReturnValue('7d');
      mockPrisma.refreshToken.create.mockResolvedValue({
        id: 'token-1',
        token: 'generated-token',
        userId,
        expiresAt: new Date(),
        revoked: false,
        createdAt: new Date(),
      });

      const token = await service.createRefreshToken(userId);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith({
        data: {
          token: expect.any(String),
          userId,
          expiresAt: expect.any(Date),
        },
      });
    });

    it('should use configured expiry duration', async () => {
      const userId = 'user-1';
      mockConfig.get.mockReturnValue('30d');
      mockPrisma.refreshToken.create.mockResolvedValue({
        id: 'token-1',
        token: 'generated-token',
        userId,
        expiresAt: new Date(),
        revoked: false,
        createdAt: new Date(),
      });

      await service.createRefreshToken(userId);

      expect(mockConfig.get).toHaveBeenCalledWith('REFRESH_TOKEN_EXPIRES_IN');
    });
  });

  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'mySecurePassword123';
      const hashedPassword = 'hashedPassword123';
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

      const result = await service.hashPassword(password);

      expect(result).toBe(hashedPassword);
      expect(bcrypt.hash).toHaveBeenCalledWith(password, 10);
    });
  });

  describe('private methods via public interface', () => {
    it('should calculate expiry correctly for days', async () => {
      mockConfig.get.mockReturnValue('7d');
      mockPrisma.refreshToken.create.mockResolvedValue({
        id: 'token-1',
        token: 'token',
        userId: 'user-1',
        expiresAt: new Date(),
        revoked: false,
        createdAt: new Date(),
      });

      await service.createRefreshToken('user-1');

      const createCall = mockPrisma.refreshToken.create.mock.calls[0][0];
      const expiresAt = createCall.data.expiresAt as Date;
      const now = new Date();
      const diffDays = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      expect(diffDays).toBeGreaterThanOrEqual(6);
      expect(diffDays).toBeLessThanOrEqual(7);
    });

    it('should calculate expiry correctly for hours', async () => {
      mockConfig.get.mockReturnValue('24h');
      mockPrisma.refreshToken.create.mockResolvedValue({
        id: 'token-1',
        token: 'token',
        userId: 'user-1',
        expiresAt: new Date(),
        revoked: false,
        createdAt: new Date(),
      });

      await service.createRefreshToken('user-1');

      const createCall = mockPrisma.refreshToken.create.mock.calls[0][0];
      const expiresAt = createCall.data.expiresAt as Date;
      const now = new Date();
      const diffHours = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60));

      expect(diffHours).toBeGreaterThanOrEqual(23);
      expect(diffHours).toBeLessThanOrEqual(24);
    });

    it('should calculate expiry correctly for minutes', async () => {
      mockConfig.get.mockReturnValue('60m');
      mockPrisma.refreshToken.create.mockResolvedValue({
        id: 'token-1',
        token: 'token',
        userId: 'user-1',
        expiresAt: new Date(),
        revoked: false,
        createdAt: new Date(),
      });

      await service.createRefreshToken('user-1');

      const createCall = mockPrisma.refreshToken.create.mock.calls[0][0];
      const expiresAt = createCall.data.expiresAt as Date;
      const now = new Date();
      const diffMinutes = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60));

      expect(diffMinutes).toBeGreaterThanOrEqual(59);
      expect(diffMinutes).toBeLessThanOrEqual(60);
    });
  });
});
