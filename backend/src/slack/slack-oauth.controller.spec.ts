import { SlackOAuthController } from './slack-oauth.controller';

describe('SlackOAuthController', () => {
  const svc: any = {
    startOAuthFlow: jest.fn(),
    handleCallback: jest.fn(),
    getIntegrationStatus: jest.fn(),
    unlinkIntegration: jest.fn()
  };

  const controller = new SlackOAuthController(svc as any);

  beforeEach(() => jest.clearAllMocks());

  it('startOAuth returns 400 when missing params', async () => {
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.startOAuth(undefined as any, undefined as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalled();
  });

  it('startOAuth redirects when ok', async () => {
    const res: any = { redirect: jest.fn() };
    svc.startOAuthFlow.mockResolvedValue('https://x');
    await controller.startOAuth('org','u', res);
    expect(res.redirect).toHaveBeenCalledWith('https://x');
  });

  it('handleCallback redirects on missing params', async () => {
    const res: any = { redirect: jest.fn() };
    await controller.handleCallback(undefined as any, undefined as any, res);
    expect(res.redirect).toHaveBeenCalledWith(`/settings/integrations?error=missing_parameters`);
  });

  it('handleCallback redirects to success on ok', async () => {
    const res: any = { redirect: jest.fn() };
    svc.handleCallback.mockResolvedValue({ teamName: 'Team' });
    await controller.handleCallback('c','s', res);
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('success=true'));
  });

  it('handleCallback redirects to error on thrown', async () => {
    const res: any = { redirect: jest.fn() };
    svc.handleCallback.mockRejectedValue(new Error('fail'));
    await controller.handleCallback('c','s', res);
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('error='));
  });

  it('getStatus returns integration wrapper', async () => {
    svc.getIntegrationStatus.mockResolvedValue({ foo: 'bar' });
    const r = await controller.getStatus('org');
    expect(r).toEqual({ integration: { foo: 'bar' } });
  });

  it('unlink calls service and returns message', async () => {
    svc.unlinkIntegration.mockResolvedValue(undefined);
    const r = await controller.unlink('org');
    expect(r).toEqual({ message: 'Integration unlinked successfully' });
  });
});
