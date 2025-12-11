import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { LocalStrategy } from './local.strategy';
import { AuthService } from '../auth.service';

describe('LocalStrategy', () => {
  let strategy: LocalStrategy;
  let authService: AuthService;

  const mockAuthService = {
    validateUser: jest.fn(),
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
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalStrategy,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    strategy = module.get<LocalStrategy>(LocalStrategy);
    authService = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return user when credentials are valid', async () => {
      mockAuthService.validateUser.mockResolvedValue(mockUser);

      const result = await strategy.validate('test@example.com', 'password123');

      expect(result).toEqual(mockUser);
      expect(authService.validateUser).toHaveBeenCalledWith('test@example.com', 'password123');
    });

    it('should throw UnauthorizedException when user is null', async () => {
      mockAuthService.validateUser.mockResolvedValue(null);

      await expect(strategy.validate('invalid@example.com', 'wrongpassword')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(strategy.validate('invalid@example.com', 'wrongpassword')).rejects.toThrow(
        'Invalid email or password',
      );
      expect(authService.validateUser).toHaveBeenCalledWith('invalid@example.com', 'wrongpassword');
    });

    it('should throw UnauthorizedException when validateUser returns falsy value', async () => {
      mockAuthService.validateUser.mockResolvedValue(undefined);

      await expect(strategy.validate('test@example.com', 'password')).rejects.toThrow(UnauthorizedException);
    });

    it('should call validateUser with correct email and password', async () => {
      mockAuthService.validateUser.mockResolvedValue(mockUser);

      await strategy.validate('user@test.com', 'securepass');

      expect(authService.validateUser).toHaveBeenCalledTimes(1);
      expect(authService.validateUser).toHaveBeenCalledWith('user@test.com', 'securepass');
    });
  });
});
