import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SlackOAuthService } from './slack-oauth.service';

describe('SlackOAuthService', () => {
  const mockPrisma: any = {
    oAuthState: { create: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
    slackIntegration: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() }
  };

  const svc = new SlackOAuthService(mockPrisma as any);

  beforeEach(() => jest.clearAllMocks());

  it('startOAuthFlow creates state and returns url', async () => {
    mockPrisma.oAuthState.create.mockResolvedValue({ state: 's' });
    const url = await svc.startOAuthFlow('org1', 'u1');
    expect(url).toMatch(/^https:\/\/slack.com\/oauth\/v2\/authorize\?/);
    expect(mockPrisma.oAuthState.create).toHaveBeenCalled();
  });

  it('handleCallback throws when state missing', async () => {
    mockPrisma.oAuthState.findUnique.mockResolvedValue(null);
    await expect(svc.handleCallback('c', 's')).rejects.toThrow(BadRequestException);
  });

  it('handleCallback throws when state expired and deletes state', async () => {
    const old = new Date(Date.now() - 1000 * 60 * 60);
    mockPrisma.oAuthState.findUnique.mockResolvedValue({ id: 'st1', organizationId: 'org', userId: 'u', expiresAt: old });
    mockPrisma.oAuthState.delete.mockResolvedValue({});
    // exchangeCodeForToken will not be called because expiry is checked first
    await expect(svc.handleCallback('c', 's')).rejects.toThrow(BadRequestException);
    expect(mockPrisma.oAuthState.delete).toHaveBeenCalledWith({ where: { id: 'st1' } });
  });

  it('handleCallback creates integration when none exists', async () => {
    const future = new Date(Date.now() + 1000 * 60 * 5);
    mockPrisma.oAuthState.findUnique.mockResolvedValue({ id: 'st2', organizationId: 'orgX', userId: 'uX', expiresAt: future });
    mockPrisma.slackIntegration.findFirst.mockResolvedValue(null);
    (svc as any).exchangeCodeForToken = jest.fn().mockResolvedValue({ ok: true, access_token: 't', team: { id: 'T1', name: 'Team' }, authed_user: { access_token: 'uT' }, scope: 'a,b' });
    mockPrisma.slackIntegration.create.mockResolvedValue({});
    mockPrisma.oAuthState.delete.mockResolvedValue({});

    const res = await svc.handleCallback('c', 's');
    expect(mockPrisma.slackIntegration.create).toHaveBeenCalled();
    expect(mockPrisma.oAuthState.delete).toHaveBeenCalledWith({ where: { id: 'st2' } });
    expect(res).toEqual({ organizationId: 'orgX', teamName: 'Team' });
  });

  it('getIntegrationStatus returns null when no integration', async () => {
    mockPrisma.slackIntegration.findFirst.mockResolvedValue(null);
    const r = await svc.getIntegrationStatus('org1');
    expect(r).toBeNull();
  });

  it('getIntegrationStatus formats active integration', async () => {
    const integration = { teamId: 'T', teamName: 'Team', scopes: 'a,b', installedBy: { id: 'u' }, installedAt: new Date(), active: true };
    mockPrisma.slackIntegration.findFirst.mockResolvedValue(integration);
    const r = await svc.getIntegrationStatus('org1');
    expect(r).toEqual(expect.objectContaining({ teamId: 'T', teamName: 'Team', scopes: ['a','b'] }));
  });

  it('unlinkIntegration throws when missing', async () => {
    mockPrisma.slackIntegration.findFirst.mockResolvedValue(null);
    await expect(svc.unlinkIntegration('orgX')).rejects.toThrow(NotFoundException);
  });

  it('unlinkIntegration updates when present', async () => {
    mockPrisma.slackIntegration.findFirst.mockResolvedValue({ id: 'i1' });
    mockPrisma.slackIntegration.update.mockResolvedValue({});
    await svc.unlinkIntegration('orgX');
    expect(mockPrisma.slackIntegration.update).toHaveBeenCalledWith({ where: { id: 'i1' }, data: { active: false } });
  });

  it('handleAppUninstalled updates when found', async () => {
    mockPrisma.slackIntegration.findFirst.mockResolvedValue({ id: 'i2' });
    mockPrisma.slackIntegration.update.mockResolvedValue({});
    await svc.handleAppUninstalled('T1');
    expect(mockPrisma.slackIntegration.update).toHaveBeenCalledWith({ where: { id: 'i2' }, data: { active: false } });
  });

  it('exchangeCodeForToken throws when slack returns not ok', async () => {
    // create a fresh instance so previous tests' mocks don't interfere
    const svcLocal = new SlackOAuthService(mockPrisma as any);
    (globalThis as any).fetch = jest.fn().mockResolvedValue({ json: async () => ({ ok: false, error: 'bad' }) });
    await expect((svcLocal as any).exchangeCodeForToken('c')).rejects.toThrow(BadRequestException);
    delete (globalThis as any).fetch;
  });

});
