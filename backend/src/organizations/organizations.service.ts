import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UserRole } from '@prisma/client';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async getMembers(organizationId: string) {
    const members = await this.prisma.user.findMany({
      where: { organizationId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true,
      },
      orderBy: [
        { role: 'asc' }, // OWNER first
        { createdAt: 'asc' },
      ],
    });

    return members;
  }

  async updateMemberRole(
    organizationId: string,
    userId: string,
    dto: UpdateMemberRoleDto,
    currentUserId: string,
  ) {
    // Verify user belongs to organization
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
    });

    if (!user) {
      throw new NotFoundException('User not found in organization');
    }

    // Prevent self role change
    if (userId === currentUserId) {
      throw new ForbiddenException('Cannot change your own role');
    }

    // If changing from OWNER, ensure at least one owner remains
    if (user.role === UserRole.OWNER && dto.role !== UserRole.OWNER) {
      const ownerCount = await this.prisma.user.count({
        where: {
          organizationId,
          role: UserRole.OWNER,
        },
      });

      if (ownerCount <= 1) {
        throw new BadRequestException('Cannot remove the last owner');
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { role: dto.role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true,
      },
    });

    return updatedUser;
  }

  async removeMember(
    organizationId: string,
    userId: string,
    currentUserId: string,
  ) {
    // Verify user belongs to organization
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
    });

    if (!user) {
      throw new NotFoundException('User not found in organization');
    }

    // Prevent self removal
    if (userId === currentUserId) {
      throw new ForbiddenException('Cannot remove yourself');
    }

    // If user is OWNER, ensure at least one owner remains
    if (user.role === UserRole.OWNER) {
      const ownerCount = await this.prisma.user.count({
        where: {
          organizationId,
          role: UserRole.OWNER,
        },
      });

      if (ownerCount <= 1) {
        throw new BadRequestException('Cannot remove the last owner');
      }
    }

    await this.prisma.user.delete({
      where: { id: userId },
    });

    return { message: 'Member removed successfully' };
  }
}
