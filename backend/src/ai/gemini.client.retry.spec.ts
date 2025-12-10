import { GeminiClient } from './gemini.client';
import { ConfigService } from '@nestjs/config';

describe('GeminiClient retries', () => {
  it('retries on failures and eventually returns text', async () => {
    const cfg: any = { get: jest.fn().mockReturnValue('key') };
    const client = new GeminiClient(cfg as ConfigService);

    // replace genAI.getGenerativeModel to simulate failing then succeeding
    const attempts: any[] = [];
    const model = {
      generateContent: jest.fn()
        .mockRejectedValueOnce(new Error('fail1'))
        .mockRejectedValueOnce(new Error('fail2'))
        .mockResolvedValue({ response: { text: () => 'final text' } }),
    };

    (client as any).genAI.getGenerativeModel = jest.fn().mockReturnValue(model);

    const res = await client.generateText('prompt');
    expect(res).toBe('final text');
    expect(model.generateContent).toHaveBeenCalledTimes(3);
  });
});
