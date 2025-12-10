import { SlackJobProcessor } from './slack-job.processor';

describe('SlackJobProcessor', () => {
  const mockSlackJobs: any = { createIncidentChannelAndAnnounce: jest.fn() };
  const mockPrisma: any = {
    incident: { findUnique: jest.fn(), update: jest.fn() },
    timelineEvent: { create: jest.fn() }
  };

  const processor = new SlackJobProcessor(mockSlackJobs as any, mockPrisma as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('handles create-incident-channel job and writes timeline event', async () => {
    mockSlackJobs.createIncidentChannelAndAnnounce.mockResolvedValue({ channelId: 'C_INC', channelName: 'inc-1-2025-01-01', messageTs: '1600000000.000' });
    mockPrisma.incident.findUnique.mockResolvedValue({ id: 'inc_1', refId: 'INC-1' });

    // call private handler
    await (processor as any).handleCreateIncidentJob({ refId: 'INC-1', title: 'T', createdAt: '2025-01-01', service: 'api', reporterId: 'U1' });

    expect(mockSlackJobs.createIncidentChannelAndAnnounce).toHaveBeenCalledWith(expect.objectContaining({ refId: 'INC-1' }));
    expect(mockPrisma.incident.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'inc_1' },
      data: { slackChannelId: 'C_INC', slackChannelName: 'inc-1-2025-01-01' }
    }));
    expect(mockPrisma.timelineEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        incidentId: 'inc_1',
        message: expect.stringContaining('Incident created via Slack'),
        slackTs: '1600000000.000',
        metadata: expect.objectContaining({ slackChannelId: 'C_INC', slackChannelName: 'inc-1-2025-01-01' })
      })
    }));
  });
});
