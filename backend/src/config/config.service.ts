import * as dotenv from "dotenv";
dotenv.config();

export class ConfigService {
  private readonly env: Record<string, string | undefined> = process.env;

  get(key: string, fallback?: string): string {
    const v = this.env[key];
    if (v === undefined || v === null) return fallback ?? "";
    return v;
  }

  getNumber(key: string, fallback?: number): number {
    const v = this.get(key);
    const n = Number(v);
    if (Number.isNaN(n)) return fallback ?? 0;
    return n;
  }

  get slackBotToken(): string {
    return this.get("SLACK_BOT_TOKEN");
  }

  get slackSigningSecret(): string {
    return this.get("SLACK_SIGNING_SECRET");
  }

  get otelServiceName(): string {
    const base = this.get("OTEL_SERVICE_NAME_PREFIX") || this.get("SERVICE_NAME");
    if (this.get("OTEL_SERVICE_NAME")) return this.get("OTEL_SERVICE_NAME");
    if (base && base.trim().length > 0) return `${base}-api`;
    return "triage-tracker-api";
  }

  get port(): number {
    return this.getNumber("PORT", 3000);
  }

  get frontendUrl(): string {
    return this.get("FRONTEND_URL", "http://localhost:5173");
  }

  validateRequired(keys: string[]): string[] {
    const missing: string[] = [];
    for (const k of keys) {
      const v = this.get(k);
      if (!v || v.trim().length === 0) missing.push(k);
    }
    return missing;
  }
}

export default new ConfigService();
