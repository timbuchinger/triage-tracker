import { NotFoundException, BadRequestException } from "@nestjs/common";
import { EventType, Status } from "@prisma/client";
import { IncidentsService } from "./incidents.service";

describe('IncidentsService', () => {
  const mockPrisma: any = {
    incident: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn()
    },
    service: {
      findUnique: jest.fn()
    },
    team: {
      findFirst: jest.fn()
    },
    timelineEvent: {
      create: jest.fn()
    },
    incidentSummary: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn()
    }
  };

  const mockAi = {
    generateIncidentSummary: jest.fn()
  };

  const mockSlackQueue = {
    enqueueCreateIncident: jest.fn()
  };
  const svc = new IncidentsService(mockPrisma as any, mockAi as any, mockSlackQueue as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('findAll forwards to prisma.findMany', async () => {
    mockPrisma.incident.findMany.mockResolvedValue([{ id: '1' }]);
    const res = await svc.findAll();
    expect(res).toEqual([{ id: '1' }]);
    expect(mockPrisma.incident.findMany).toHaveBeenCalled();
  });

  it('findAll applies filters to prisma.findMany', async () => {
    mockPrisma.incident.findMany.mockResolvedValue([{ id: '2' }]);
    const res = await svc.findAll({ statuses: ["OPEN"], dateRange: "7", ownerId: "u1" });
    expect(res).toEqual([{ id: '2' }]);
    expect(mockPrisma.incident.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: { in: ["OPEN"] },
        OR: [
          { reporterId: "u1" },
          { ownerId: "u1" }
        ]
      })
    }));
  });

  it('findOne forwards to prisma.findUnique', async () => {
    mockPrisma.incident.findUnique.mockResolvedValue({ refId: 'INC-1' });
    const res = await svc.findOne('INC-1');
    expect(res).toEqual({ refId: 'INC-1' });
    expect(mockPrisma.incident.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { refId: 'INC-1' } }));
  });

  it('create generates a refId and calls prisma.create', async () => {
    mockPrisma.incident.create.mockResolvedValue({ refId: 'INC-9999', title: 'x' });
    const dto: any = { title: 'x', description: 'd', severity: 'HIGH', serviceId: null };
    const res = await svc.create(dto);
    expect(mockPrisma.incident.create).toHaveBeenCalled();
    expect(res).toEqual({ refId: 'INC-9999', title: 'x' });
  });

  it('addTimelineEvent looks up incident and creates timeline event', async () => {
    mockPrisma.incident.findUnique.mockResolvedValue({ id: 'i1' });
    mockPrisma.timelineEvent.create.mockResolvedValue({ id: 't1' });

    const dto: any = { type: EventType.STATUS_CHANGE, message: 'm', slackTs: null, slackUser: null };
    const res = await svc.addTimelineEvent('INC-1', dto);
    expect(mockPrisma.timelineEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ incidentId: 'i1', message: 'm' }) }));
    expect(res).toEqual({ id: 't1' });
  });

  it('addSummary creates a summary after finding incident', async () => {
    mockPrisma.incident.findUnique.mockResolvedValue({ id: 'i2' });
    mockPrisma.incidentSummary.create.mockResolvedValue({ id: 's1' });

    const dto: any = { content: 'c' };
    const res = await svc.addSummary('INC-2', dto);
    expect(mockPrisma.incidentSummary.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ incidentId: 'i2', content: 'c' }) }));
    expect(res).toEqual({ id: 's1' });
  });

  it('generateSummary throws NotFound if incident missing', async () => {
    mockPrisma.incident.findUnique.mockResolvedValue(null);
    await expect(svc.generateSummary('INC-X')).rejects.toThrow(NotFoundException);
  });

  it('generateSummary rejects when not resolved', async () => {
    mockPrisma.incident.findUnique.mockResolvedValue({ id: 'i3', status: Status.OPEN });
    await expect(svc.generateSummary('INC-X')).rejects.toThrow(BadRequestException);
  });

  it('generateSummary calls ai service and creates summary and timeline event when resolved', async () => {
    mockPrisma.incident.findUnique.mockResolvedValue({ id: 'i4', status: Status.RESOLVED });
    mockAi.generateIncidentSummary.mockResolvedValue('AI_SUM');
    mockPrisma.incidentSummary.create.mockResolvedValue({ id: 's2', content: 'AI_SUM' });
    mockPrisma.timelineEvent.create.mockResolvedValue({ id: 't2' });

    const res = await svc.generateSummary('INC-OK');
    expect(mockAi.generateIncidentSummary).toHaveBeenCalledWith('i4');
    expect(mockPrisma.incidentSummary.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ incidentId: 'i4', content: 'AI_SUM' }) }));
    expect(mockPrisma.timelineEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ incidentId: 'i4', type: EventType.AI_SUMMARY }) }));
    expect(res).toEqual({ id: 's2', content: 'AI_SUM' });
  });

  it('updateSummary throws NotFound when summary not found', async () => {
    mockPrisma.incident.findUnique.mockResolvedValue({ id: 'i5' });
    mockPrisma.incidentSummary.findFirst.mockResolvedValue(null);
    await expect(svc.updateSummary('INC-5', 'no-id', 'x')).rejects.toThrow(NotFoundException);
  });

  it('updateSummary updates when summary exists', async () => {
    mockPrisma.incident.findUnique.mockResolvedValue({ id: 'i6' });
    mockPrisma.incidentSummary.findFirst.mockResolvedValue({ id: 's3', metadata: { a: 1 } });
    mockPrisma.incidentSummary.update.mockResolvedValue({ id: 's3', content: 'new' });

    const res = await svc.updateSummary('INC-6', 's3', 'new');
    expect(mockPrisma.incidentSummary.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 's3' } }));
    expect(res).toEqual({ id: 's3', content: 'new' });
  });

  it('updateStatusAndLog updates status and writes timeline event', async () => {
    mockPrisma.incident.update.mockResolvedValue({ id: 'i7', status: Status.RESOLVED });
    mockPrisma.timelineEvent.create.mockResolvedValue({ id: 't7' });

    const event: any = { type: EventType.STATUS_CHANGE, message: 'ok', timestamp: undefined };
    const res = await svc.updateStatusAndLog('INC-7', Status.RESOLVED, event);
    expect(mockPrisma.incident.update).toHaveBeenCalledWith(expect.objectContaining({ where: { refId: 'INC-7' } }));
    expect(mockPrisma.timelineEvent.create).toHaveBeenCalled();
    expect(res).toEqual({ id: 'i7', status: Status.RESOLVED });
  });
});
