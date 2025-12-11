import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { Roles, ROLES_KEY } from './roles.decorator';

describe('Roles Decorator', () => {
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
  });

  it('should set metadata with single role', () => {
    class TestController {
      @Roles(UserRole.OWNER)
      testMethod() {}
    }

    const roles = reflector.get<UserRole[]>(ROLES_KEY, TestController.prototype.testMethod);
    expect(roles).toEqual([UserRole.OWNER]);
  });

  it('should set metadata with multiple roles', () => {
    class TestController {
      @Roles(UserRole.OWNER, UserRole.MEMBER)
      testMethod() {}
    }

    const roles = reflector.get<UserRole[]>(ROLES_KEY, TestController.prototype.testMethod);
    expect(roles).toEqual([UserRole.OWNER, UserRole.MEMBER]);
  });

  it('should set metadata with MEMBER role', () => {
    class TestController {
      @Roles(UserRole.MEMBER)
      testMethod() {}
    }

    const roles = reflector.get<UserRole[]>(ROLES_KEY, TestController.prototype.testMethod);
    expect(roles).toEqual([UserRole.MEMBER]);
  });

  it('should work on class level', () => {
    @Roles(UserRole.OWNER)
    class TestController {}

    const roles = reflector.get<UserRole[]>(ROLES_KEY, TestController);
    expect(roles).toEqual([UserRole.OWNER]);
  });

  it('should export ROLES_KEY constant', () => {
    expect(ROLES_KEY).toBe('roles');
  });
});
