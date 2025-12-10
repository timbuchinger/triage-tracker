import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";
import { SLACK_CONFIG, SlackConfig } from "./slack.constants";

const MAX_TIMESTAMP_SKEW_SECONDS = 60 * 5;

@Injectable()
export class SlackSignatureGuard implements CanActivate {
  constructor(@Inject(SLACK_CONFIG) private readonly config: SlackConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest() as {
      headers: Record<string, string | string[] | undefined>;
      rawBody?: Buffer;
    };

    const timestamp = req.headers["x-slack-request-timestamp"];
    const signature = req.headers["x-slack-signature"];

    if (!timestamp || !signature || !req.rawBody?.length) {
      throw new UnauthorizedException("Missing Slack signature");
    }

    const tsNum = Number(timestamp);
    const now = Math.floor(Date.now() / 1000);
    if (Number.isNaN(tsNum) || Math.abs(now - tsNum) > MAX_TIMESTAMP_SKEW_SECONDS) {
      throw new UnauthorizedException("Stale Slack signature");
    }

    const expected = this.sign(tsNum, req.rawBody.toString("utf8"));
    const expectedBuf = Buffer.from(expected);
    const providedBuf = Buffer.from(signature as string);

    if (expectedBuf.length !== providedBuf.length || !timingSafeEqual(expectedBuf, providedBuf)) {
      throw new UnauthorizedException("Invalid Slack signature");
    }

    return true;
  }

  private sign(timestamp: number, rawBody: string) {
    const base = `v0:${timestamp}:${rawBody}`;
    const hmac = createHmac("sha256", this.config.signingSecret);
    hmac.update(base);
    const digest = hmac.digest("hex");
    return `v0=${digest}`;
  }
}
