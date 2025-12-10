import { SlackClient } from './slack.client';

describe('SlackClient', () => {
  const config = { botToken: 'bt' } as any;
  let client: SlackClient;

  beforeEach(() => {
    client = new SlackClient(config);
    (globalThis as any).fetch = jest.fn().mockResolvedValue({ json: async () => ({ ok: true }) });
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete (globalThis as any).fetch;
  });

  it('openView calls views.open', async () => {
    (globalThis as any).fetch.mockResolvedValue({ json: async () => ({ ok: true }) });
    await client.openView('t', { callback_id: 'x' } as any);
    expect((globalThis as any).fetch).toHaveBeenCalledWith(expect.stringContaining('/views.open'), expect.any(Object));
  });

  it('postMessage calls chat.postMessage and returns ts', async () => {
    (globalThis as any).fetch.mockResolvedValue({ json: async () => ({ ok: true, ts: '123' }) });
    const res = await client.postMessage({ channel: 'C', text: 'hi' });
    expect(res).toEqual({ ok: true, ts: '123' });
  });

  it('createChannel returns channel info', async () => {
    (globalThis as any).fetch.mockResolvedValue({ json: async () => ({ ok: true, channel: { id: 'C1', name: 'n' } }) });
    const res = await client.createChannel('name');
    expect(res).toEqual({ ok: true, channel: { id: 'C1', name: 'n' } });
  });

  it('inviteUsers returns undefined when no users', async () => {
    const r = await (client as any).inviteUsers('C', []);
    expect(r).toBeUndefined();
    expect((globalThis as any).fetch).not.toHaveBeenCalled();
  });

  it('inviteUsers calls conversations.invite when users provided', async () => {
    (globalThis as any).fetch.mockResolvedValue({ json: async () => ({ ok: true }) });
    await (client as any).inviteUsers('C', ['U1','U2']);
    expect((globalThis as any).fetch).toHaveBeenCalledWith(expect.stringContaining('/conversations.invite'), expect.any(Object));
  });

  it('fetchMessage returns first message', async () => {
    (globalThis as any).fetch.mockResolvedValue({ json: async () => ({ ok: true, messages: [{ text: 'm' }] }) });
    const m = await client.fetchMessage('C', '123');
    expect(m).toEqual({ text: 'm' });
  });

  it('call throws when slack returns ok: false', async () => {
    (globalThis as any).fetch.mockResolvedValue({ json: async () => ({ ok: false, error: 'bad' }) });
    await expect(client.postMessage({ channel: 'C', text: 'x' })).rejects.toThrow(/Slack API chat.postMessage failed/);
  });
});
