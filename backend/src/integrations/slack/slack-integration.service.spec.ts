import { UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { SlackIntegrationService } from './slack-integration.service';

describe('SlackIntegrationService', () => {
  const mockPrisma: any = {
    oAuthState: { create: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
    slackIntegration: { upsert: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findFirst: jest.fn() }
  };

  const mockConfig: any = {
    get: jest.fn((k: string) => {
      if (k === 'SLACK_CLIENT_ID') return 'cid';
      if (k === 'SLACK_CLIENT_SECRET') return 'csecret';
      if (k === 'SLACK_SIGNING_SECRET') return 'ssecret';
      if (k === 'SLACK_REDIRECT_URI') return 'http://localhost/cb';
      return '';
    })
  };

  const svc = new SlackIntegrationService(mockPrisma as any, mockConfig as any);

  beforeEach(() => jest.clearAllMocks());

  it('generateOAuthUrl creates state and returns url', async () => {
    mockPrisma.oAuthState.create.mockResolvedValue({ state: 'abc' });
    const url = await svc.generateOAuthUrl('org1', 'u1');
    expect(url).toMatch(/^https:\/\/slack.com\/oauth\/v2\/authorize\?/);
    expect(mockPrisma.oAuthState.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ organizationId: 'org1', userId: 'u1' }) }));
  });

  it('handleCallback throws when state missing', async () => {
    mockPrisma.oAuthState.findUnique.mockResolvedValue(null);
    await expect(svc.handleCallback('code', 's1')).rejects.toThrow(UnauthorizedException);
  });

  it('handleCallback throws when state expired and deletes state', async () => {
    const old = new Date(Date.now() - 1000 * 60 * 60);
    mockPrisma.oAuthState.findUnique.mockResolvedValue({ state: 's', organizationId: 'o', userId: 'u', expiresAt: old });
    mockPrisma.oAuthState.delete.mockResolvedValue({});
    // stub exchange not called; expect Unauthorized due to expiry
    await expect(svc.handleCallback('code', 's')).rejects.toThrow(UnauthorizedException);
    expect(mockPrisma.oAuthState.delete).toHaveBeenCalledWith({ where: { state: 's' } });
  });

  it('handleCallback throws when token exchange fails', async () => {
    const future = new Date(Date.now() + 1000 * 60 * 5);
    mockPrisma.oAuthState.findUnique.mockResolvedValue({ state: 's', organizationId: 'o', userId: 'u', expiresAt: future });
    (svc as any).exchangeCodeForToken = jest.fn().mockResolvedValue({ ok: false, error: 'bad' });
    await expect(svc.handleCallback('code', 's')).rejects.toThrow(BadRequestException);
  });

  it('handleCallback upserts integration and deletes state on success', async () => {
    const future = new Date(Date.now() + 1000 * 60 * 5);
    mockPrisma.oAuthState.findUnique.mockResolvedValue({ state: 's', organizationId: 'orgX', userId: 'uX', expiresAt: future });
    const tokenResp = { ok: true, access_token: 't', team: { id: 'T1', name: 'Team' }, authed_user: { access_token: 'uT' }, scope: 'a,b' };
    (svc as any).exchangeCodeForToken = jest.fn().mockResolvedValue(tokenResp);
    mockPrisma.slackIntegration.upsert.mockResolvedValue({});
    mockPrisma.oAuthState.delete.mockResolvedValue({});

    const res = await svc.handleCallback('c', 's');
    expect(mockPrisma.slackIntegration.upsert).toHaveBeenCalled();
    expect(mockPrisma.oAuthState.delete).toHaveBeenCalledWith({ where: { state: 's' } });
    expect(res).toEqual({ teamName: 'Team', organizationId: 'orgX' });
  });

  it('getIntegrationStatus returns null when missing or inactive', async () => {
    mockPrisma.slackIntegration.findUnique.mockResolvedValue(null);
    const res = await svc.getIntegrationStatus('org1');
    expect(res).toBeNull();

    mockPrisma.slackIntegration.findUnique.mockResolvedValue({ active: false });
    const res2 = await svc.getIntegrationStatus('org1');
    expect(res2).toBeNull();
  });

  it('getIntegrationStatus returns formatted object when active', async () => {
    const integration = {
      teamId: 'T1', teamName: 'Team', scopes: 'a,b', installedBy: { id: 'u', name: 'n' }, installedAt: new Date(), lastEventAt: null, active: true
    };
    mockPrisma.slackIntegration.findUnique.mockResolvedValue(integration);
    const res = await svc.getIntegrationStatus('org1');
    expect(res).toEqual(expect.objectContaining({ teamId: 'T1', teamName: 'Team', scopes: ['a', 'b'] }));
  });

  it('uninstall throws if integration missing', async () => {
    mockPrisma.slackIntegration.findUnique.mockResolvedValue(null);
    await expect(svc.uninstall('orgX')).rejects.toThrow(NotFoundException);
  });

  it('uninstall updates integration to inactive', async () => {
    mockPrisma.slackIntegration.findUnique.mockResolvedValue({ id: 'i1' });
    mockPrisma.slackIntegration.update.mockResolvedValue({});
    await svc.uninstall('orgX');
    expect(mockPrisma.slackIntegration.update).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'orgX' } }));
  });

  it('handleAppUninstalled updates when integration exists', async () => {
    mockPrisma.slackIntegration.findFirst.mockResolvedValue({ id: 'i2' });
    mockPrisma.slackIntegration.update.mockResolvedValue({});
    await svc.handleAppUninstalled('T1');
    expect(mockPrisma.slackIntegration.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'i2' } }));
  });

  it('verifySlackSignature returns false for old timestamps', () => {
    // old timestamp far in past
    const old = Math.floor((Date.now() - 1000 * 60 * 60) / 1000).toString();
    const ok = svc.verifySlackSignature('nope', old, 'body');
    expect(ok).toBe(false);
  });

  it('verifySlackSignature validates correct signature', () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = 'payload';
    // build signature using same secret
    const crypto = require('crypto');
    const basestring = `v0:${timestamp}:${body}`;
    const mySig = 'v0=' + crypto.createHmac('sha256', 'ssecret').update(basestring).digest('hex');
    const ok = svc.verifySlackSignature(mySig, timestamp, body);
    expect(ok).toBe(true);
  });

  it('getBotToken returns decrypted token when present or null when missing', async () => {
    mockPrisma.slackIntegration.findUnique.mockResolvedValue(null);
    const r1 = await svc.getBotToken('org1');
    expect(r1).toBeNull();

    const token = `encrypted:${Buffer.from('mytoken').toString('base64')}`;
    mockPrisma.slackIntegration.findUnique.mockResolvedValue({ botToken: token, active: true });
    const r2 = await svc.getBotToken('org1');
    expect(r2).toBe('mytoken');
  });
});
