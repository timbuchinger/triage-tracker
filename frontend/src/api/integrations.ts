import { request } from "./client";
import { API_BASE_URL } from "@/config";

export interface SlackIntegrationStatus {
  connected: boolean;
  integration: {
    teamId: string;
    teamName: string;
    scopes: string[];
    installedBy: {
      id: string;
      name: string | null;
      email: string;
    };
    installedAt: string;
    lastEventAt: string | null;
    active: boolean;
  } | null;
}

export interface SlackOAuthStartResponse {
  url: string;
}

export async function getSlackIntegrationStatus(organizationId: string): Promise<SlackIntegrationStatus> {
  return request<SlackIntegrationStatus>(`/integrations/slack/${organizationId}/status`);
}

export async function startSlackOAuth(organizationId: string, userId: string): Promise<SlackOAuthStartResponse> {
  return request<SlackOAuthStartResponse>(
    `/integrations/slack/start?organizationId=${organizationId}&userId=${userId}`
  );
}

export async function uninstallSlackIntegration(organizationId: string): Promise<{ success: boolean; message: string }> {
  return request(`/integrations/slack/${organizationId}`, {
    method: "DELETE"
  });
}

export function getSlackCallbackUrl(): string {
  return `${API_BASE_URL}/integrations/slack/callback`;
}

export interface SlackUserMappingStatus {
  linked: boolean;
  mapping?: { slackUserId: string; linkedAt: string } | null;
}

export async function getSlackUserMappingStatus(organizationId: string, userId: string): Promise<SlackUserMappingStatus> {
  return request<SlackUserMappingStatus>(`/integrations/slack/user/status?organizationId=${organizationId}&userId=${userId}`);
}

export async function startSlackUserLink(organizationId: string, userId: string): Promise<SlackOAuthStartResponse> {
  return request<SlackOAuthStartResponse>(`/integrations/slack/user/start?organizationId=${organizationId}&userId=${userId}`);
}

export async function unlinkSlackUser(organizationId: string, userId: string): Promise<{ success: boolean }> {
  return request(`/integrations/slack/user/unlink`, {
    method: 'POST',
    body: JSON.stringify({ organizationId, userId })
  });
}
