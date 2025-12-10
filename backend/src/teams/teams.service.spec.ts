import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { PrismaService } from '../database/prisma.service';

describe('TeamsService', () => {
  let service: TeamsService;
  const mockPrisma: any = {
    team: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    teamMember: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockTeam = {
    id: 'team-1',
    name: 'Engineering Team',
    organizationId: 'org-1',
    isDefault: false,
    primaryContactId: 'user-1',
    secondaryContactId: 'user-2',
    createdAt: new Date(),
    updatedAt: new Date(),
    primaryContact: { id: 'user-1', name: 'Alice', email: 'alice@example.com' },
    secondaryContact: { id: 'user-2', name: 'Bob', email: 'bob@example.com' },
    members: [
      { id: 'member-1', userId: 'user-1', teamId: 'team-1', user: { id: 'user-1', name: 'Alice', email: 'alice@example.com' } },
    ],
    services: [],
    _count: { services: 0, incidents: 0 },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    service = new TeamsService(mockPrisma);
  });

  describe('findAll', () => {
    it('should return all teams for an organization', async () => {
      const teams = [mockTeam];
      mockPrisma.team.findMany.mockResolvedValue(teams);

      const result = await service.findAll('org-1');

      expect(result).toEqual(teams);
      expect(mockPrisma.team.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        include: expect.any(Object),
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      });
    });

    it('should order teams with default team first', async () => {
      const defaultTeam = { ...mockTeam, id: 'team-default', isDefault: true };
      const teams = [defaultTeam, mockTeam];
      mockPrisma.team.findMany.mockResolvedValue(teams);

      await service.findAll('org-1');

      expect(mockPrisma.team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        })
      );
    });
  });

  describe('findOne', () => {
    it('should return a team by id', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(mockTeam);

      const result = await service.findOne('team-1');

      expect(result).toEqual(mockTeam);
      expect(mockPrisma.team.findUnique).toHaveBeenCalledWith({
        where: { id: 'team-1' },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException when team does not exist', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
      await expect(service.findOne('nonexistent')).rejects.toThrow('Team nonexistent not found');
    });
  });

  describe('create', () => {
    const createDto = {
      name: 'New Team',
      organizationId: 'org-1',
      isDefault: false,
      primaryContactId: 'user-1',
      secondaryContactId: 'user-2',
      memberIds: ['user-1', 'user-2'],
    };

    it('should create a new team', async () => {
      mockPrisma.team.findFirst.mockResolvedValue(null);
      mockPrisma.team.create.mockResolvedValue(mockTeam);

      const result = await service.create(createDto);

      expect(result).toEqual(mockTeam);
      expect(mockPrisma.team.create).toHaveBeenCalledWith({
        data: {
          name: createDto.name,
          organizationId: createDto.organizationId,
          isDefault: createDto.isDefault,
          primaryContactId: createDto.primaryContactId,
          secondaryContactId: createDto.secondaryContactId,
          members: {
            create: createDto.memberIds.map(userId => ({ userId })),
          },
        },
        include: expect.any(Object),
      });
    });

    it('should create team without members when memberIds is empty', async () => {
      const dtoWithoutMembers = { ...createDto, memberIds: [] };
      mockPrisma.team.findFirst.mockResolvedValue(null);
      mockPrisma.team.create.mockResolvedValue(mockTeam);

      await service.create(dtoWithoutMembers);

      expect(mockPrisma.team.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            members: undefined,
          }),
        })
      );
    });

    it('should throw ConflictException when default team already exists', async () => {
      const defaultDto = { ...createDto, isDefault: true };
      mockPrisma.team.findFirst.mockResolvedValue({ ...mockTeam, isDefault: true });

      await expect(service.create(defaultDto)).rejects.toThrow(ConflictException);
      await expect(service.create(defaultDto)).rejects.toThrow('A default team already exists for this organization');
    });

    it('should throw BadRequestException when primary and secondary contacts are the same', async () => {
      const invalidDto = { ...createDto, primaryContactId: 'user-1', secondaryContactId: 'user-1' };

      await expect(service.create(invalidDto)).rejects.toThrow(BadRequestException);
      await expect(service.create(invalidDto)).rejects.toThrow('Primary and secondary contacts must be different');
    });

    it('should allow creating default team when none exists', async () => {
      const defaultDto = { ...createDto, isDefault: true };
      mockPrisma.team.findFirst.mockResolvedValue(null);
      mockPrisma.team.create.mockResolvedValue({ ...mockTeam, isDefault: true });

      const result = await service.create(defaultDto);

      expect(result.isDefault).toBe(true);
    });
  });

  describe('update', () => {
    const updateDto = {
      name: 'Updated Team',
      isDefault: false,
      primaryContactId: 'user-3',
      secondaryContactId: 'user-4',
    };

    it('should update a team', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(mockTeam);
      mockPrisma.team.update.mockResolvedValue({ ...mockTeam, ...updateDto });

      const result = await service.update('team-1', updateDto);

      expect(result.name).toBe(updateDto.name);
      expect(mockPrisma.team.update).toHaveBeenCalledWith({
        where: { id: 'team-1' },
        data: updateDto,
        include: expect.any(Object),
      });
    });

    it('should throw BadRequestException when unsetting default status', async () => {
      const defaultTeam = { ...mockTeam, isDefault: true };
      mockPrisma.team.findUnique.mockResolvedValue(defaultTeam);

      await expect(service.update('team-1', { isDefault: false })).rejects.toThrow(BadRequestException);
      await expect(service.update('team-1', { isDefault: false })).rejects.toThrow('Cannot unset default status');
    });

    it('should unset other defaults when setting team as default', async () => {
      const updateToDefault = { ...updateDto, isDefault: true };
      mockPrisma.team.findUnique.mockResolvedValue(mockTeam);
      mockPrisma.team.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.team.update.mockResolvedValue({ ...mockTeam, isDefault: true });

      await service.update('team-1', updateToDefault);

      expect(mockPrisma.team.updateMany).toHaveBeenCalledWith({
        where: {
          organizationId: mockTeam.organizationId,
          isDefault: true,
          id: { not: 'team-1' },
        },
        data: { isDefault: false },
      });
    });

    it('should throw BadRequestException when primary and secondary contacts are the same', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(mockTeam);

      await expect(service.update('team-1', {
        primaryContactId: 'user-1',
        secondaryContactId: 'user-1',
      })).rejects.toThrow(BadRequestException);
    });

    it('should update members when memberIds is provided', async () => {
      const updateWithMembers = { ...updateDto, memberIds: ['user-3', 'user-4'] };
      mockPrisma.team.findUnique.mockResolvedValue(mockTeam);
      mockPrisma.teamMember.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.teamMember.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.team.update.mockResolvedValue(mockTeam);

      await service.update('team-1', updateWithMembers);

      expect(mockPrisma.teamMember.deleteMany).toHaveBeenCalledWith({
        where: { teamId: 'team-1' },
      });
      expect(mockPrisma.teamMember.createMany).toHaveBeenCalledWith({
        data: updateWithMembers.memberIds.map(userId => ({ teamId: 'team-1', userId })),
      });
    });

    it('should remove all members when memberIds is empty array', async () => {
      const updateWithNoMembers = { ...updateDto, memberIds: [] };
      mockPrisma.team.findUnique.mockResolvedValue(mockTeam);
      mockPrisma.teamMember.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.team.update.mockResolvedValue(mockTeam);

      await service.update('team-1', updateWithNoMembers);

      expect(mockPrisma.teamMember.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.teamMember.createMany).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete a non-default team', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(mockTeam);
      mockPrisma.team.delete.mockResolvedValue(mockTeam);

      const result = await service.delete('team-1');

      expect(result).toEqual(mockTeam);
      expect(mockPrisma.team.delete).toHaveBeenCalledWith({ where: { id: 'team-1' } });
    });

    it('should throw BadRequestException when deleting default team', async () => {
      const defaultTeam = { ...mockTeam, isDefault: true };
      mockPrisma.team.findUnique.mockResolvedValue(defaultTeam);

      await expect(service.delete('team-1')).rejects.toThrow(BadRequestException);
      await expect(service.delete('team-1')).rejects.toThrow('Cannot delete the default team');
    });

    it('should throw BadRequestException when team has services', async () => {
      const teamWithServices = {
        ...mockTeam,
        services: [{ id: 'service-1', name: 'Service 1' }],
      };
      mockPrisma.team.findUnique.mockResolvedValue(teamWithServices);

      await expect(service.delete('team-1')).rejects.toThrow(BadRequestException);
      await expect(service.delete('team-1')).rejects.toThrow('Cannot delete team with assigned services');
    });
  });

  describe('addMembers', () => {
    const addMembersDto = { memberIds: ['user-3', 'user-4'] };

    it('should add members to a team', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(mockTeam);
      mockPrisma.teamMember.findMany.mockResolvedValue([]);
      mockPrisma.teamMember.createMany.mockResolvedValue({ count: 2 });

      const result = await service.addMembers('team-1', addMembersDto);

      expect(mockPrisma.teamMember.createMany).toHaveBeenCalledWith({
        data: addMembersDto.memberIds.map(userId => ({ teamId: 'team-1', userId })),
      });
      expect(mockPrisma.team.findUnique).toHaveBeenCalledTimes(2); // Once in addMembers, once in findOne
    });

    it('should throw ConflictException when some users are already members', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(mockTeam);
      mockPrisma.teamMember.findMany.mockResolvedValue([
        { id: 'member-2', userId: 'user-3', teamId: 'team-1' },
      ]);

      await expect(service.addMembers('team-1', addMembersDto)).rejects.toThrow(ConflictException);
      await expect(service.addMembers('team-1', addMembersDto)).rejects.toThrow('Some users are already members of this team');
    });
  });

  describe('removeMember', () => {
    it('should remove a member from a team', async () => {
      const teamMember = { id: 'member-1', userId: 'user-1', teamId: 'team-1' };
      const teamWithMultipleMembers = {
        ...mockTeam,
        members: [
          { id: 'member-1', userId: 'user-1', teamId: 'team-1', user: { id: 'user-1', name: 'Alice', email: 'alice@example.com' } },
          { id: 'member-2', userId: 'user-2', teamId: 'team-1', user: { id: 'user-2', name: 'Bob', email: 'bob@example.com' } },
        ],
      };

      mockPrisma.team.findUnique.mockResolvedValue(teamWithMultipleMembers);
      mockPrisma.teamMember.findUnique.mockResolvedValue(teamMember);
      mockPrisma.teamMember.delete.mockResolvedValue(teamMember);

      await service.removeMember('team-1', 'user-1');

      expect(mockPrisma.teamMember.delete).toHaveBeenCalledWith({
        where: { teamId_userId: { teamId: 'team-1', userId: 'user-1' } },
      });
    });

    it('should throw NotFoundException when user is not a member', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(mockTeam);
      mockPrisma.teamMember.findUnique.mockResolvedValue(null);

      await expect(service.removeMember('team-1', 'user-999')).rejects.toThrow(NotFoundException);
      await expect(service.removeMember('team-1', 'user-999')).rejects.toThrow('User is not a member of this team');
    });

    it('should throw BadRequestException when removing last member from default team', async () => {
      const defaultTeamWithOneMember = {
        ...mockTeam,
        isDefault: true,
        members: [mockTeam.members[0]],
      };
      mockPrisma.team.findUnique.mockResolvedValue(defaultTeamWithOneMember);

      await expect(service.removeMember('team-1', 'user-1')).rejects.toThrow(BadRequestException);
      await expect(service.removeMember('team-1', 'user-1')).rejects.toThrow('Cannot remove the last member from the default team');
    });

    it('should clear primary contact when removing primary contact user', async () => {
      const teamMember = { id: 'member-1', userId: 'user-1', teamId: 'team-1' };
      const teamWithMultipleMembers = {
        ...mockTeam,
        primaryContactId: 'user-1',
        members: [
          { id: 'member-1', userId: 'user-1', teamId: 'team-1', user: { id: 'user-1', name: 'Alice', email: 'alice@example.com' } },
          { id: 'member-2', userId: 'user-2', teamId: 'team-1', user: { id: 'user-2', name: 'Bob', email: 'bob@example.com' } },
        ],
      };

      mockPrisma.team.findUnique.mockResolvedValue(teamWithMultipleMembers);
      mockPrisma.teamMember.findUnique.mockResolvedValue(teamMember);
      mockPrisma.team.update.mockResolvedValue(teamWithMultipleMembers);
      mockPrisma.teamMember.delete.mockResolvedValue(teamMember);

      await service.removeMember('team-1', 'user-1');

      expect(mockPrisma.team.update).toHaveBeenCalledWith({
        where: { id: 'team-1' },
        data: {
          primaryContactId: null,
          secondaryContactId: undefined,
        },
      });
    });

    it('should clear secondary contact when removing secondary contact user', async () => {
      const teamMember = { id: 'member-2', userId: 'user-2', teamId: 'team-1' };
      const teamWithMultipleMembers = {
        ...mockTeam,
        secondaryContactId: 'user-2',
        members: [
          { id: 'member-1', userId: 'user-1', teamId: 'team-1', user: { id: 'user-1', name: 'Alice', email: 'alice@example.com' } },
          { id: 'member-2', userId: 'user-2', teamId: 'team-1', user: { id: 'user-2', name: 'Bob', email: 'bob@example.com' } },
        ],
      };

      mockPrisma.team.findUnique.mockResolvedValue(teamWithMultipleMembers);
      mockPrisma.teamMember.findUnique.mockResolvedValue(teamMember);
      mockPrisma.team.update.mockResolvedValue(teamWithMultipleMembers);
      mockPrisma.teamMember.delete.mockResolvedValue(teamMember);

      await service.removeMember('team-1', 'user-2');

      expect(mockPrisma.team.update).toHaveBeenCalledWith({
        where: { id: 'team-1' },
        data: {
          primaryContactId: undefined,
          secondaryContactId: null,
        },
      });
    });
  });

  describe('getDefaultTeam', () => {
    it('should return the default team for an organization', async () => {
      const defaultTeam = { ...mockTeam, isDefault: true };
      mockPrisma.team.findFirst.mockResolvedValue(defaultTeam);

      const result = await service.getDefaultTeam('org-1');

      expect(result).toEqual(defaultTeam);
      expect(mockPrisma.team.findFirst).toHaveBeenCalledWith({
        where: { organizationId: 'org-1', isDefault: true },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException when no default team exists', async () => {
      mockPrisma.team.findFirst.mockResolvedValue(null);

      await expect(service.getDefaultTeam('org-1')).rejects.toThrow(NotFoundException);
      await expect(service.getDefaultTeam('org-1')).rejects.toThrow('No default team found for this organization');
    });
  });
});
