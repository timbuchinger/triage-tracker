export const SLACK_CONFIG = "SLACK_CONFIG";

export interface SlackConfig {
  signingSecret: string;
  botToken: string;
}
