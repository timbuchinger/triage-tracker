import { SlackJobProcessor } from './slack-job.processor';

describe('SlackJobProcessor', () => {
  const mockSlackJobs: any = { createIncidentChannelAndAnnounce: jest.fn() };
  const mockPrisma: any = {
    incident: { findUnique: jest.fn(), update: jest.fn(), findFirst: jest.fn() },
    timelineEvent: { create: jest.fn(), findFirst: jest.fn(), delete: jest.fn(), update: jest.fn() }
  };
  const mockSlackClient: any = { fetchMessage: jest.fn() };

  const processor = new SlackJobProcessor(mockSlackJobs as any, mockPrisma as any, mockSlackClient as any);

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

  it('handles reaction-added job and creates timeline event', async () => {
    mockPrisma.incident.findFirst.mockResolvedValue({ id: 'inc_1', refId: 'INC-1' });
    mockPrisma.timelineEvent.findFirst.mockResolvedValue(null);
    mockSlackClient.fetchMessage.mockResolvedValue({
      text: 'Important message',
      user: 'U123',
      reactions: [{ name: '+1', count: 1 }]
    });

    await (processor as any).handleReactionAdded({
      channelId: 'C1',
      messageTs: '1672531200.000',
      userId: 'U456',
      reaction: 'thumbsup',
      eventTs: '1672531201.000'
    });

    expect(mockPrisma.incident.findFirst).toHaveBeenCalledWith({
      where: { slackChannelId: 'C1' }
    });
    expect(mockSlackClient.fetchMessage).toHaveBeenCalledWith('C1', '1672531200.000');
    expect(mockPrisma.timelineEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        incidentId: 'inc_1',
        type: 'HIGHLIGHTED_MESSAGE',
        message: 'Important message',
        slackTs: '1672531200.000',
        slackUser: 'U123',
        metadata: expect.objectContaining({
          capturedBy: 'U456'
        }),
        thumbsCount: 1
      })
    });
  });

  it('handles reaction-added for existing event and updates metadata/thumbsCount', async () => {
    mockPrisma.incident.findFirst.mockResolvedValue({ id: 'inc_1', refId: 'INC-1' });
    mockPrisma.timelineEvent.findFirst.mockResolvedValue({ id: 'evt_1', metadata: { reactions: [{ name: '+1', count: 2 }] }, thumbsCount: 2 });
    mockSlackClient.fetchMessage.mockResolvedValue({
      text: 'Updated message',
      user: 'U123',
      reactions: [{ name: '+1', count: 3 }],
      permalink: 'http://x'
    });

    await (processor as any).handleReactionAdded({
      channelId: 'C1',
      messageTs: '1672531200.000',
      userId: 'U456',
      reaction: 'thumbsup',
      eventTs: '1672531201.000'
    });

    expect(mockPrisma.timelineEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt_1' },
      data: expect.objectContaining({ metadata: expect.objectContaining({ reactions: [{ name: '+1', count: 3 }], permalink: 'http://x' }), thumbsCount: 3 })
    });
  });

  it('handles reaction-removed job and deletes timeline event', async () => {
    mockPrisma.incident.findFirst.mockResolvedValue({ id: 'inc_1', refId: 'INC-1' });
    mockPrisma.timelineEvent.findFirst.mockResolvedValue({
      id: 'event_1',
      slackTs: '1672531200.000'
    });

    mockSlackClient.fetchMessage.mockResolvedValue({ reactions: [] });

    await (processor as any).handleReactionRemoved({
      channelId: 'C1',
      messageTs: '1672531200.000',
      userId: 'U456',
      reaction: 'thumbsup',
      eventTs: '1672531201.000'
    });

    expect(mockPrisma.incident.findFirst).toHaveBeenCalledWith({
      where: { slackChannelId: 'C1' }
    });
    expect(mockPrisma.timelineEvent.findFirst).toHaveBeenCalledWith({
      where: {
        incidentId: 'inc_1',
        type: 'HIGHLIGHTED_MESSAGE',
        slackTs: '1672531200.000'
      }
    });
    expect(mockPrisma.timelineEvent.delete).toHaveBeenCalledWith({
      where: { id: 'event_1' }
    });
  });

  it('does not delete timeline event if thumbs still present and updates metadata', async () => {
    mockPrisma.incident.findFirst.mockResolvedValue({ id: 'inc_1', refId: 'INC-1' });
    mockPrisma.timelineEvent.findFirst.mockResolvedValue({
      id: 'event_2',
      slackTs: '1672531200.000',
      metadata: { reactions: [{ name: '+1', count: 2 }] }
    });

    mockSlackClient.fetchMessage.mockResolvedValue({ reactions: [{ name: '+1', count: 1, users: ['U1'] }], permalink: 'http://x' });

    await (processor as any).handleReactionRemoved({
      channelId: 'C1',
      messageTs: '1672531200.000',
      userId: 'U456',
      reaction: 'thumbsup',
      eventTs: '1672531201.000'
    });

    expect(mockPrisma.timelineEvent.update).toHaveBeenCalledWith({
      where: { id: 'event_2' },
      data: { metadata: expect.objectContaining({ reactions: [{ name: '+1', count: 1, users: ['U1'] }], permalink: 'http://x' }), thumbsCount: 1 }
    });
    expect(mockPrisma.timelineEvent.delete).not.toHaveBeenCalledWith({ where: { id: 'event_2' } });
  });
});
