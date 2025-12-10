import { SlackController } from './slack.controller';

describe('SlackController', () => {
  const slackInc = { handleSlashCommand: jest.fn(), handleInteraction: jest.fn(), handleEvent: jest.fn() };
  const slackOAuth = { handleAppUninstalled: jest.fn() };

  const ctrl = new SlackController(slackInc as any, slackOAuth as any);

  beforeEach(() => jest.clearAllMocks());

  it('handleSlash delegates to slackIncService', () => {
    (slackInc.handleSlashCommand as jest.Mock).mockReturnValue({ ok: true });
    const res = ctrl.handleSlash({ text: 'x' });
    expect(res).toEqual({ ok: true });
    expect(slackInc.handleSlashCommand).toHaveBeenCalled();
  });

  it('handleInteractions delegates to slackIncService', () => {
    (slackInc.handleInteraction as jest.Mock).mockReturnValue({});
    const res = ctrl.handleInteractions('payload');
    expect(res).toEqual({});
    expect(slackInc.handleInteraction).toHaveBeenCalledWith('payload');
  });
  // The controller does not expose a unified `handleEvents` method anymore;
  // keep tests focused on the current public handlers above.

});
