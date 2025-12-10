import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuthService } from '../auth/auth.service';
import { UserRole } from '@prisma/client';
import { CreateInviteDto } from './dto/create-invite.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';

@Injectable()
export class InvitesService {
  private readonly logger = new Logger(InvitesService.name);

  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
  ) {}

  async createInvite(organizationId: string, dto: CreateInviteDto) {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    // Check for existing unused invite
    const existingInvite = await this.prisma.invite.findFirst({
      where: {
        email: dto.email,
        organizationId,
        used: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvite) {
      throw new BadRequestException('Active invite already exists for this email');
    }

    const token = this.generateSecureToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    const invite = await this.prisma.invite.create({
      data: {
        email: dto.email,
        token,
        role: dto.role || UserRole.MEMBER,
        organizationId,
        expiresAt,
      },
      include: {
        organization: true,
      },
    });

    // Mock email - print invite link to console
    const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/invite/accept?token=${token}`;
    this.logger.log('====================================');
    this.logger.log('INVITATION EMAIL (mock)');
    this.logger.log('====================================');
    this.logger.log(`To: ${dto.email}`);
    this.logger.log(`Organization: ${invite.organization.name}`);
    this.logger.log(`Role: ${invite.role}`);
    this.logger.log(`Expires: ${expiresAt.toISOString()}`);
    this.logger.log('');
    this.logger.log(`Invitation Link:`);
    this.logger.log(inviteUrl);
    this.logger.log('====================================');

    return {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      inviteUrl, // Return URL for convenience in dev
    };
  }

  async acceptInvite(dto: AcceptInviteDto) {
    const invite = await this.prisma.invite.findUnique({
      where: { token: dto.token },
      include: { organization: true },
    });

    if (!invite) {
      throw new UnauthorizedException('Invalid invite token');
    }

    if (invite.used) {
      throw new UnauthorizedException('Invite has already been used');
    }

    if (invite.expiresAt < new Date()) {
      throw new UnauthorizedException('Invite has expired');
    }

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: invite.email },
    });

    if (existingUser) {
      throw new BadRequestException('User already exists');
    }

    // Create user and mark invite as used
    const passwordHash = await this.authService.hashPassword(dto.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: invite.email,
          passwordHash,
          name: dto.name,
          role: invite.role,
          organizationId: invite.organizationId,
        },
      });

      await tx.invite.update({
        where: { id: invite.id },
        data: { used: true },
      });

      return newUser;
    });

    this.logger.log(`User ${user.email} accepted invite and joined ${invite.organization.name}`);

    return {
      message: 'Invite accepted successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        organizationId: user.organizationId,
        role: user.role,
      },
    };
  }

  async listInvites(organizationId: string) {
    const invites = await this.prisma.invite.findMany({
      where: {
        organizationId,
        used: false,
        expiresAt: { gt: new Date() },
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

    return invites;
  }

  private generateSecureToken(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('base64url');
  }
}
