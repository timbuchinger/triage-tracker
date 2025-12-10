import { UnauthorizedException } from "@nestjs/common";
import { createHmac } from "crypto";
import { SlackSignatureGuard } from "./slack-signature.guard";

const signingSecret = "test_secret";

const sign = (timestamp: number, body: string) => {
  const hmac = createHmac("sha256", signingSecret);
  hmac.update(`v0:${timestamp}:${body}`);
  return `v0=${hmac.digest("hex")}`;
};

const buildContext = (body: string, timestamp: number, signature: string) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {
          "x-slack-request-timestamp": String(timestamp),
          "x-slack-signature": signature
        },
        rawBody: Buffer.from(body)
      })
    })
  }) as any;

describe("SlackSignatureGuard", () => {
  it("accepts a valid signature within skew", () => {
    const now = Math.floor(Date.now() / 1000);
    const body = "token=1&team_id=T123";
    const signature = sign(now, body);
    const guard = new SlackSignatureGuard({ signingSecret, botToken: "" });

    expect(guard.canActivate(buildContext(body, now, signature))).toBe(true);
  });

  it("rejects invalid signatures", () => {
    const now = Math.floor(Date.now() / 1000);
    const body = "text=oops";
    const guard = new SlackSignatureGuard({ signingSecret, botToken: "" });

    expect(() => guard.canActivate(buildContext(body, now, "v0=bad"))).toThrow(
      UnauthorizedException
    );
  });

  it("rejects stale signatures", () => {
    const timestamp = Math.floor(Date.now() / 1000) - 4000;
    const body = "text=old";
    const guard = new SlackSignatureGuard({ signingSecret, botToken: "" });
    const signature = sign(timestamp, body);

    expect(() => guard.canActivate(buildContext(body, timestamp, signature))).toThrow(
      UnauthorizedException
    );
  });
});
