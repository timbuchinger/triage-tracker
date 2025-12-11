import { Injectable, Logger } from "@nestjs/common";
import { SlackConfig } from "./slack.constants";


type SlackResponse<T> = { ok: boolean; error?: string } & T;

@Injectable()
export class SlackClient {
  private readonly logger = new Logger(SlackClient.name);

  constructor(private readonly config: SlackConfig) {}

  async openView(triggerId: string, view: Record<string, unknown>) {
    return this.call("views.open", { trigger_id: triggerId, view });
  }

  async postMessage(params: { channel: string; text: string; blocks?: unknown[] }) {
    return this.call<{ ts?: string; channel?: string }>("chat.postMessage", params);
  }

  async createChannel(name: string) {
    return this.call<{ channel: { id: string; name: string } }>("conversations.create", { name });
  }

  async inviteUsers(channel: string, users: string[]) {
    if (!users.length) {
      return;
    }
    return this.call("conversations.invite", { channel, users: users.join(",") });
  }

  async setChannelTopic(channel: string, topic: string) {
    return this.call("conversations.setTopic", { channel, topic });
  }

  async fetchMessage(channelId: string, messageTs: string) {
    const result = await this.call<{ messages?: any[] }>("conversations.history", {
      channel: channelId,
      latest: messageTs,
      limit: 1,
      inclusive: true,
    });

    return result.messages?.[0];
  }

  async fetchUser(userId: string) {
    const result = await this.call<{ user?: any }>("users.info", { user: userId });
    return result.user;
  }

  async resolveUserNamesInText(text?: string) {
    if (!text) return text;

    // Find unique Slack user mentions like <@U123ABC>
    const matches = Array.from(text.matchAll(/<@([A-Z0-9]+)>/g));
    const ids = Array.from(new Set(matches.map((m) => m[1])));
    if (!ids.length) return text;

    // Fetch user info for each id in parallel, ignoring failures per-user
    const users = await Promise.all(ids.map((id) => this.fetchUser(id).catch(() => null)));

    const nameById = new Map<string, string>();
    ids.forEach((id, i) => {
      const u = users[i];
      const display = u?.profile?.display_name || u?.real_name || u?.name || id;
      nameById.set(id, display);
    });

    return text.replace(/<@([A-Z0-9]+)>/g, (_m, id) => `@${nameById.get(id) ?? id}`);
  }

  async pinMessage(channel: string, timestamp: string) {
    return this.call("pins.add", { channel, timestamp });
  }

  private async call<T = Record<string, unknown>>(method: string, body: Record<string, unknown>) {
    const response = await (globalThis as any).fetch(`https://slack.com/api/${method}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.botToken}`,
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify(body)
    });

    const data = (await response.json()) as SlackResponse<T>;
    if (!data.ok) {
      const message = `Slack API ${method} failed: ${data.error ?? "unknown_error"}`;
      this.logger.error(message);
      throw new Error(message);
    }

    return data;
  }
}
