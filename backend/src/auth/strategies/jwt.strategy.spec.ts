import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { JwtStrategy } from './jwt.strategy';
import { JwtPayload } from '../auth.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    mockConfigService.get.mockReturnValue('test-secret-key');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    configService = module.get<ConfigService>(ConfigService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return user object from JWT payload', async () => {
      const payload: JwtPayload = {
        sub: 'user-1',
        email: 'test@example.com',
        organizationId: 'org-1',
        role: UserRole.MEMBER,
      };

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        organizationId: 'org-1',
        role: UserRole.MEMBER,
      });
    });

    it('should handle OWNER role', async () => {
      const payload: JwtPayload = {
        sub: 'owner-1',
        email: 'owner@example.com',
        organizationId: 'org-1',
        role: UserRole.OWNER,
      };

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        id: 'owner-1',
        email: 'owner@example.com',
        organizationId: 'org-1',
        role: UserRole.OWNER,
      });
    });

    it('should map sub to id correctly', async () => {
      const payload: JwtPayload = {
        sub: 'unique-user-id',
        email: 'user@test.com',
        organizationId: 'org-2',
        role: UserRole.MEMBER,
      };

      const result = await strategy.validate(payload);

      expect(result.id).toBe('unique-user-id');
    });

    it('should preserve all payload fields', async () => {
      const payload: JwtPayload = {
        sub: 'user-123',
        email: 'complete@example.com',
        organizationId: 'org-456',
        role: UserRole.OWNER,
      };

      const result = await strategy.validate(payload);

      expect(result).toMatchObject({
        id: payload.sub,
        email: payload.email,
        organizationId: payload.organizationId,
        role: payload.role,
      });
    });
  });
});
