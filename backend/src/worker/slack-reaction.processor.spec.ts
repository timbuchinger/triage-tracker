import { SlackReactionProcessor } from './slack-reaction.processor';

describe('SlackReactionProcessor', () => {
  const mockPrisma: any = {
    incident: { findFirst: jest.fn() },
    timelineEvent: { findFirst: jest.fn(), create: jest.fn() }
  };

  const mockSlackClient: any = { fetchMessage: jest.fn() };

  const processor = new SlackReactionProcessor(mockPrisma as any, mockSlackClient as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns when channel is not linked to an incident', async () => {
    mockPrisma.incident.findFirst.mockResolvedValue(null);

    await processor.process({ name: 'reaction-added', data: { channelId: 'C1', messageTs: '123.000', userId: 'U1' } } as any);

    expect(mockPrisma.timelineEvent.create).not.toHaveBeenCalled();
  });

  it('skips when message already captured', async () => {
    mockPrisma.incident.findFirst.mockResolvedValue({ id: 'inc1', refId: 'INC-1' });
    mockPrisma.timelineEvent.findFirst.mockResolvedValue({ id: 'te1' });

    await processor.process({ name: 'reaction-added', data: { channelId: 'C1', messageTs: '123.000', userId: 'U1' } } as any);

    expect(mockPrisma.timelineEvent.create).not.toHaveBeenCalled();
  });

  it('fetches message and creates a timeline event', async () => {
    mockPrisma.incident.findFirst.mockResolvedValue({ id: 'inc1', refId: 'INC-1' });
    mockPrisma.timelineEvent.findFirst.mockResolvedValue(null);
    const message = { text: 'Important message', user: 'U999', reactions: [{ name: '+1', users: ['U1'] }], permalink: 'https://slack.com/...' };
    mockSlackClient.fetchMessage.mockResolvedValue(message);

    await processor.process({ name: 'reaction-added', data: { channelId: 'C1', messageTs: '1672531200.000', userId: 'U1' } } as any);

    expect(mockPrisma.timelineEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        incidentId: 'inc1',
        type: expect.any(String),
        message: 'Important message',
        slackTs: '1672531200.000',
        slackUser: 'U999',
        metadata: expect.objectContaining({ reactions: message.reactions, permalink: message.permalink })
      })
    }));
  });
});
