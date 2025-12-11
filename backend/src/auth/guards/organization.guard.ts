import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class OrganizationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const orgId = request.params?.orgId;

    if (!user || !orgId) {
      throw new ForbiddenException('Access denied');
    }

    if (user.organizationId !== orgId) {
      throw new ForbiddenException('Access denied');
    }

    return true;
  }
}
