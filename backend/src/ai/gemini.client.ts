import { GoogleGenerativeAI } from '@google/generative-ai';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GEMINI_MODEL } from './constants';

@Injectable()
export class GeminiClient {
  private readonly logger = new Logger(GeminiClient.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly model: string = GEMINI_MODEL;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY not configured');
    }
    this.genAI = new GoogleGenerativeAI(apiKey || '');
  }

  async generateText(prompt: string): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: this.model });

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          const t = setTimeout(() => reject(new Error('Request timeout')), 30000);
          if (typeof (t as any)?.unref === 'function') {
            (t as any).unref();
          }
        });

        const result = await Promise.race([
          model.generateContent(prompt),
          timeoutPromise,
        ]);

        const response = result.response;
        const text = response.text();

        if (!text) {
          throw new Error('Empty response from Gemini API');
        }

        return text;
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `Gemini API attempt ${attempt}/${maxRetries} failed: ${lastError.message}`
        );

        if (attempt < maxRetries) {
          const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
      }
    }

    throw new Error(`Gemini API failed after ${maxRetries} attempts: ${lastError?.message}`);
  }
}
