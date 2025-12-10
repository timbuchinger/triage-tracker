jest.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContent: jest.fn().mockResolvedValue({ response: { text: () => 'hello world' } })
      })
    }))
  };
});

import { GeminiClient } from './gemini.client';
import { ConfigService } from '@nestjs/config';

describe('GeminiClient', () => {
  it('generateText returns text from model', async () => {
    const cfg: any = { get: jest.fn().mockReturnValue('apikey') };
    const client = new GeminiClient(cfg as ConfigService);
    const res = await client.generateText('prompt');
    expect(res).toBe('hello world');
  });
});
