jest.mock('bullmq', () => ({ Queue: jest.fn().mockImplementation(() => ({ add: jest.fn().mockResolvedValue({}) })) }));

import { SlackQueueService } from './slack-queue.service';

describe('SlackQueueService', () => {
  const cfg: any = {};
  let svc: SlackQueueService;

  beforeEach(() => {
    svc = new SlackQueueService(cfg as any);
  });

  it('enqueueCreateIncident calls queue.add', async () => {
    const res = await svc.enqueueCreateIncident({ refId: 'r1', title: 't', createdAt: new Date().toISOString(), reporterId: 'u' });
    expect(res).toEqual({});
  });

  it('enqueueStatusUpdate calls queue.add', async () => {
    const res = await svc.enqueueStatusUpdate({ channelId: 'C', refId: 'r1', status: 'OPEN', statusText: 'x' });
    expect(res).toEqual({});
  });

  it('queueReactionAdded calls queue.add', async () => {
    const res = await svc.queueReactionAdded({ channelId: 'C', messageTs: 'm', userId: 'u', reaction: 'thumbsup', eventTs: 'e' });
    expect(res).toEqual({});
  });

  it('queueReactionRemoved calls queue.add', async () => {
    const res = await svc.queueReactionRemoved({ channelId: 'C', messageTs: 'm', userId: 'u', reaction: 'thumbsup', eventTs: 'e' });
    expect(res).toEqual({});
  });

  it('parseRedisUrl extracts host and port', () => {
    // @ts-ignore access private via any
    const parsed = (svc as any).parseRedisUrl('redis://:pass@localhost:6379');
    expect(parsed).toEqual(expect.objectContaining({ host: 'localhost', port: 6379 }));
  });
});
