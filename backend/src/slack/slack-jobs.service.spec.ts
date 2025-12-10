import { SlackJobsService } from './slack-jobs.service';

describe('SlackJobsService', () => {
  const mockClient: any = {
    createChannel: jest.fn(),
    inviteUsers: jest.fn(),
    setChannelTopic: jest.fn(),
    postMessage: jest.fn()
  };

  const mockPrisma: any = {
    slackIntegration: { findUnique: jest.fn() },
    slackUserMapping: { findUnique: jest.fn() }
  };

  const mockSlackIntegrationService: any = {
    getBotToken: jest.fn()
  };

  const svc = new SlackJobsService(mockPrisma as any, mockSlackIntegrationService as any, (config: any) => mockClient as any);

  beforeEach(() => jest.clearAllMocks());

  it('createIncidentChannelAndAnnounce creates channel and posts', async () => {
    mockClient.createChannel.mockResolvedValue({ channel: { id: 'C1', name: 'c1' } });
    mockClient.inviteUsers.mockResolvedValue(undefined);
    mockClient.setChannelTopic.mockResolvedValue(undefined);
    mockClient.postMessage.mockResolvedValue({ ts: 't1' });

    const res = await svc.createIncidentChannelAndAnnounce({ refId: 'INC-1', title: 'T', createdAt: '2024-01-01', reporterId: 'U1' });
    expect(res).toEqual({ channelId: 'C1', channelName: 'c1', messageTs: 't1' });
    expect(mockClient.createChannel).toHaveBeenCalled();
  });

  it('postStatusUpdateMessage calls postMessage', async () => {
    mockClient.postMessage.mockResolvedValue({ ok: true });
    const res = await svc.postStatusUpdateMessage({ channelId: 'C', refId: 'R', status: 'OPEN', statusText: 'x' });
    expect(mockClient.postMessage).toHaveBeenCalledWith(expect.objectContaining({ channel: 'C' }));
    expect(res).toEqual({ ok: true });
  });
});
