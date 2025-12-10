import { WorkerService } from './worker.service';
import { EventType } from '@prisma/client';

describe('WorkerService', () => {
  let service: WorkerService;
  const mockPrisma: any = {
    incidentSummary: {
      create: jest.fn(),
    },
    timelineEvent: {
      create: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WorkerService(mockPrisma);
  });

  describe('runScheduledTasks', () => {
    it('should log that it is running scheduled tasks', () => {
      const loggerSpy = jest.spyOn((service as any).logger, 'log');

      service.runScheduledTasks();

      expect(loggerSpy).toHaveBeenCalledWith('Running scheduled background tasks (placeholder).');
    });
  });

  describe('recordAISummary', () => {
    const incidentId = 'incident-123';
    const content = 'This is an AI-generated summary of the incident.';
    const metadata = { model: 'gpt-4', confidence: 0.95 };

    it('should create an incident summary and timeline event', async () => {
      mockPrisma.incidentSummary.create.mockResolvedValue({
        id: 'summary-1',
        incidentId,
        content,
        metadata,
        createdAt: new Date(),
      });

      mockPrisma.timelineEvent.create.mockResolvedValue({
        id: 'event-1',
        incidentId,
        type: EventType.AI_SUMMARY,
        message: content,
        metadata,
        timestamp: new Date(),
      });

      await service.recordAISummary(incidentId, content, metadata);

      expect(mockPrisma.incidentSummary.create).toHaveBeenCalledWith({
        data: { incidentId, content, metadata },
      });

      expect(mockPrisma.timelineEvent.create).toHaveBeenCalledWith({
        data: {
          incidentId,
          type: EventType.AI_SUMMARY,
          metadata,
          message: content,
        },
      });
    });

    it('should create summary and timeline event without metadata', async () => {
      mockPrisma.incidentSummary.create.mockResolvedValue({
        id: 'summary-2',
        incidentId,
        content,
        metadata: null,
        createdAt: new Date(),
      });

      mockPrisma.timelineEvent.create.mockResolvedValue({
        id: 'event-2',
        incidentId,
        type: EventType.AI_SUMMARY,
        message: content,
        metadata: null,
        timestamp: new Date(),
      });

      await service.recordAISummary(incidentId, content);

      expect(mockPrisma.incidentSummary.create).toHaveBeenCalledWith({
        data: { incidentId, content, metadata: undefined },
      });

      expect(mockPrisma.timelineEvent.create).toHaveBeenCalledWith({
        data: {
          incidentId,
          type: EventType.AI_SUMMARY,
          metadata: undefined,
          message: content,
        },
      });
    });

    it('should handle errors from prisma operations', async () => {
      const error = new Error('Database error');
      mockPrisma.incidentSummary.create.mockRejectedValue(error);

      await expect(service.recordAISummary(incidentId, content)).rejects.toThrow('Database error');

      expect(mockPrisma.incidentSummary.create).toHaveBeenCalled();
      // Timeline event should not be called if summary creation fails
      expect(mockPrisma.timelineEvent.create).not.toHaveBeenCalled();
    });

    it('should handle different metadata types', async () => {
      const arrayMetadata = [1, 2, 3];
      mockPrisma.incidentSummary.create.mockResolvedValue({
        id: 'summary-3',
        incidentId,
        content,
        metadata: arrayMetadata,
        createdAt: new Date(),
      });

      mockPrisma.timelineEvent.create.mockResolvedValue({
        id: 'event-3',
        incidentId,
        type: EventType.AI_SUMMARY,
        message: content,
        metadata: arrayMetadata,
        timestamp: new Date(),
      });

      await service.recordAISummary(incidentId, content, arrayMetadata);

      expect(mockPrisma.incidentSummary.create).toHaveBeenCalledWith({
        data: { incidentId, content, metadata: arrayMetadata },
      });

      expect(mockPrisma.timelineEvent.create).toHaveBeenCalledWith({
        data: {
          incidentId,
          type: EventType.AI_SUMMARY,
          metadata: arrayMetadata,
          message: content,
        },
      });
    });
  });
});
