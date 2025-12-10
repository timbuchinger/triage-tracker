import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { CreateTeamDto } from "./dto/create-team.dto";
import { UpdateTeamDto } from "./dto/update-team.dto";
import { AddMembersDto } from "./dto/add-members.dto";

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string) {
    return this.prisma.team.findMany({
      where: { organizationId },
      include: {
        primaryContact: { select: { id: true, name: true, email: true } },
        secondaryContact: { select: { id: true, name: true, email: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
        },
        _count: {
          select: { services: true, incidents: true }
        }
      },
      orderBy: [
        { isDefault: 'desc' }, // Default team first
        { name: 'asc' }
      ]
    });
  }

  async findOne(id: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: {
        primaryContact: { select: { id: true, name: true, email: true } },
        secondaryContact: { select: { id: true, name: true, email: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
        },
        services: true,
        _count: {
          select: { incidents: true }
        }
      }
    });

    if (!team) {
      throw new NotFoundException(`Team ${id} not found`);
    }

    return team;
  }

  async create(dto: CreateTeamDto) {
    // Check if a default team already exists for the organization
    if (dto.isDefault) {
      const existingDefault = await this.prisma.team.findFirst({
        where: {
          organizationId: dto.organizationId,
          isDefault: true
        }
      });

      if (existingDefault) {
        throw new ConflictException('A default team already exists for this organization');
      }
    }

    // Validate primary and secondary contacts are different
    if (dto.primaryContactId && dto.secondaryContactId && dto.primaryContactId === dto.secondaryContactId) {
      throw new BadRequestException('Primary and secondary contacts must be different');
    }

    // Create team with members
    const team = await this.prisma.team.create({
      data: {
        name: dto.name,
        organizationId: dto.organizationId,
        isDefault: dto.isDefault ?? false,
        primaryContactId: dto.primaryContactId,
        secondaryContactId: dto.secondaryContactId,
        members: dto.memberIds?.length ? {
          create: dto.memberIds.map(userId => ({ userId }))
        } : undefined
      },
      include: {
        primaryContact: { select: { id: true, name: true, email: true } },
        secondaryContact: { select: { id: true, name: true, email: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
        }
      }
    });

    return team;
  }

  async update(id: string, dto: UpdateTeamDto) {
    const team = await this.findOne(id);

    // Prevent unsetting default if this is the only team or has services
    if (dto.isDefault === false && team.isDefault) {
      throw new BadRequestException('Cannot unset default status. Mark another team as default instead.');
    }

    // If setting as default, unset other defaults in the organization
    if (dto.isDefault === true) {
      await this.prisma.team.updateMany({
        where: {
          organizationId: team.organizationId,
          isDefault: true,
          id: { not: id }
        },
        data: { isDefault: false }
      });
    }

    // Validate primary and secondary contacts are different
    const primaryContactId = dto.primaryContactId ?? team.primaryContactId;
    const secondaryContactId = dto.secondaryContactId ?? team.secondaryContactId;

    if (primaryContactId && secondaryContactId && primaryContactId === secondaryContactId) {
      throw new BadRequestException('Primary and secondary contacts must be different');
    }

    // Handle member updates if provided
    if (dto.memberIds !== undefined) {
      // Remove existing members
      await this.prisma.teamMember.deleteMany({
        where: { teamId: id }
      });

      // Add new members
      if (dto.memberIds.length > 0) {
        await this.prisma.teamMember.createMany({
          data: dto.memberIds.map(userId => ({
            teamId: id,
            userId
          }))
        });
      }
    }

    return this.prisma.team.update({
      where: { id },
      data: {
        name: dto.name,
        isDefault: dto.isDefault,
        primaryContactId: dto.primaryContactId,
        secondaryContactId: dto.secondaryContactId
      },
      include: {
        primaryContact: { select: { id: true, name: true, email: true } },
        secondaryContact: { select: { id: true, name: true, email: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
        }
      }
    });
  }

  async delete(id: string) {
    const team = await this.findOne(id);

    // Prevent deletion of default team
    if (team.isDefault) {
      throw new BadRequestException('Cannot delete the default team');
    }

    // Check if team has services assigned
    if (team.services.length > 0) {
      throw new BadRequestException('Cannot delete team with assigned services. Reassign services first.');
    }

    return this.prisma.team.delete({
      where: { id }
    });
  }

  async addMembers(id: string, dto: AddMembersDto) {
    const team = await this.findOne(id);

    // Check if any member is already in the team
    const existingMembers = await this.prisma.teamMember.findMany({
      where: {
        teamId: id,
        userId: { in: dto.memberIds }
      }
    });

    if (existingMembers.length > 0) {
      throw new ConflictException('Some users are already members of this team');
    }

    await this.prisma.teamMember.createMany({
      data: dto.memberIds.map(userId => ({
        teamId: id,
        userId
      }))
    });

    return this.findOne(id);
  }

  async removeMember(id: string, userId: string) {
    const team = await this.findOne(id);

    // Prevent removing the last member from default team
    if (team.isDefault && team.members.length === 1) {
      throw new BadRequestException('Cannot remove the last member from the default team');
    }

    const member = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId: id,
          userId
        }
      }
    });

    if (!member) {
      throw new NotFoundException('User is not a member of this team');
    }

    // If removing primary or secondary contact, clear that field
    if (team.primaryContactId === userId || team.secondaryContactId === userId) {
      await this.prisma.team.update({
        where: { id },
        data: {
          primaryContactId: team.primaryContactId === userId ? null : undefined,
          secondaryContactId: team.secondaryContactId === userId ? null : undefined
        }
      });
    }

    await this.prisma.teamMember.delete({
      where: {
        teamId_userId: {
          teamId: id,
          userId
        }
      }
    });

    return this.findOne(id);
  }

  async getDefaultTeam(organizationId: string) {
    const defaultTeam = await this.prisma.team.findFirst({
      where: {
        organizationId,
        isDefault: true
      },
      include: {
        primaryContact: { select: { id: true, name: true, email: true } },
        secondaryContact: { select: { id: true, name: true, email: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
        }
      }
    });

    if (!defaultTeam) {
      throw new NotFoundException('No default team found for this organization');
    }

    return defaultTeam;
  }
}
