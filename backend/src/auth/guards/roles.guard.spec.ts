import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  const createMockExecutionContext = (user: any): ExecutionContext => ({
    switchToHttp: () => ({
      getRequest: () => ({ user }),
      getResponse: jest.fn(),
      getNext: jest.fn(),
    }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
    getType: jest.fn(),
  } as any);

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should return true when no roles are required', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      const context = createMockExecutionContext({ id: 'user-1', role: UserRole.MEMBER });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
    });

    it('should return true when user has one of the required roles', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.OWNER]);
      const context = createMockExecutionContext({ id: 'user-1', role: UserRole.OWNER });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should return true when user has OWNER role', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.OWNER]);
      const context = createMockExecutionContext({ id: 'user-1', role: UserRole.OWNER });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should return false when user does not have required role', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.OWNER]);
      const context = createMockExecutionContext({ id: 'user-1', role: UserRole.MEMBER });

      const result = guard.canActivate(context);

      expect(result).toBe(false);
    });

    it('should return false when user role is undefined', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.OWNER]);
      const context = createMockExecutionContext({ id: 'user-1', role: undefined });

      const result = guard.canActivate(context);

      expect(result).toBe(false);
    });

    it('should return true when user is MEMBER and MEMBER is required', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.MEMBER]);
      const context = createMockExecutionContext({ id: 'user-1', role: UserRole.MEMBER });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should handle multiple roles in array', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.MEMBER, UserRole.OWNER]);
      const context = createMockExecutionContext({ id: 'user-1', role: UserRole.MEMBER });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });
  });
});
