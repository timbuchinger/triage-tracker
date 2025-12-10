import { SlackIntegrationController } from './slack-integration.controller';

describe('SlackIntegrationController', () => {
  const svc: any = {
    generateOAuthUrl: jest.fn(),
    handleCallback: jest.fn(),
    getIntegrationStatus: jest.fn(),
    uninstall: jest.fn(),
    verifySlackSignature: jest.fn(),
    handleAppUninstalled: jest.fn()
  };

  const ctrl = new SlackIntegrationController(svc as any);

  beforeEach(() => jest.clearAllMocks());

  it('startOAuth returns error when missing params', async () => {
    const r = await ctrl.startOAuth(undefined as any, undefined as any);
    expect(r).toEqual({ error: 'Missing organizationId or userId' });
  });

  it('startOAuth returns url when ok', async () => {
    svc.generateOAuthUrl.mockResolvedValue('https://x');
    const r = await ctrl.startOAuth('org','u');
    expect(r).toEqual({ url: 'https://x' });
  });

  it('handleCallback redirects on error query', async () => {
    const res: any = { redirect: jest.fn() };
    await ctrl.handleCallback(undefined as any, undefined as any, 'bad', res);
    expect(res.redirect).toHaveBeenCalledWith(`/settings/integrations?error=${encodeURIComponent('bad')}`);
  });

  it('handleCallback redirects when missing params', async () => {
    const res: any = { redirect: jest.fn() };
    await ctrl.handleCallback(undefined as any, undefined as any, undefined as any, res);
    expect(res.redirect).toHaveBeenCalledWith('/settings/integrations?error=missing_params');
  });

  it('handleCallback redirects to success on ok', async () => {
    const res: any = { redirect: jest.fn() };
    svc.handleCallback.mockResolvedValue({ organizationId: 'org', teamName: 'Team' });
    await ctrl.handleCallback('c','s', undefined as any, res);
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('success=slack_connected'));
  });

  it('getStatus returns connected false when no status', async () => {
    svc.getIntegrationStatus.mockResolvedValue(null);
    const r = await ctrl.getStatus('org');
    expect(r).toEqual({ connected: false, integration: null });
  });

  it('uninstall calls service and returns success', async () => {
    svc.uninstall.mockResolvedValue(undefined);
    const r = await ctrl.uninstall('org');
    expect(r).toEqual({ success: true, message: 'Slack integration removed' });
  });

  it('handleEvents invalid signature returns error', async () => {
    const req: any = { rawBody: Buffer.from('x') };
    svc.verifySlackSignature.mockReturnValue(false);
    const r = await ctrl.handleEvents(req as any, 'sig', 'ts', { type: 'event_callback' });
    expect(r).toEqual({ error: 'Invalid signature' });
  });

  it('handleEvents url_verification returns challenge', async () => {
    const req: any = { rawBody: Buffer.from('x') };
    svc.verifySlackSignature.mockReturnValue(true);
    const r = await ctrl.handleEvents(req as any, 'sig','ts', { type: 'url_verification', challenge: 'c' });
    expect(r).toEqual({ challenge: 'c' });
  });

  it('handleEvents event_callback calls handleAppUninstalled for app_uninstalled', async () => {
    const req: any = { rawBody: Buffer.from('x') };
    svc.verifySlackSignature.mockReturnValue(true);
    const body = { type: 'event_callback', event: { type: 'app_uninstalled' }, team_id: 'T1' };
    const r = await ctrl.handleEvents(req as any, 'sig','ts', body);
    expect(svc.handleAppUninstalled).toHaveBeenCalledWith('T1');
    expect(r).toEqual({ ok: true });
  });

  it('handleInteractive validates signature', async () => {
    const req: any = { rawBody: Buffer.from('x') };
    svc.verifySlackSignature.mockReturnValue(false);
    const r = await ctrl.handleInteractive(req as any, 'sig','ts', {});
    expect(r).toEqual({ error: 'Invalid signature' });
  });

  it('handleInteractive ok when signature valid', async () => {
    const req: any = { rawBody: Buffer.from('x') };
    svc.verifySlackSignature.mockReturnValue(true);
    const r = await ctrl.handleInteractive(req as any, 'sig','ts', {});
    expect(r).toEqual({ ok: true });
  });

});
