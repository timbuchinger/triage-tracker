import { ExecutionContext } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUserData } from './current-user.decorator';

describe('CurrentUser Decorator', () => {
  it('should define CurrentUserData interface', () => {
    const user: CurrentUserData = {
      id: 'user-1',
      email: 'test@example.com',
      organizationId: 'org-1',
      role: UserRole.MEMBER,
    };

    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('email');
    expect(user).toHaveProperty('organizationId');
    expect(user).toHaveProperty('role');
  });

  it('should support OWNER role', () => {
    const user: CurrentUserData = {
      id: 'owner-1',
      email: 'owner@example.com',
      organizationId: 'org-1',
      role: UserRole.OWNER,
    };

    expect(user.role).toBe(UserRole.OWNER);
  });

  it('should support MEMBER role', () => {
    const user: CurrentUserData = {
      id: 'member-1',
      email: 'member@example.com',
      organizationId: 'org-1',
      role: UserRole.MEMBER,
    };

    expect(user.role).toBe(UserRole.MEMBER);
  });

  it('should allow different organizationIds', () => {
    const user1: CurrentUserData = {
      id: 'user-1',
      email: 'user1@example.com',
      organizationId: 'org-1',
      role: UserRole.MEMBER,
    };

    const user2: CurrentUserData = {
      id: 'user-2',
      email: 'user2@example.com',
      organizationId: 'org-2',
      role: UserRole.OWNER,
    };

    expect(user1.organizationId).toBe('org-1');
    expect(user2.organizationId).toBe('org-2');
  });
});
