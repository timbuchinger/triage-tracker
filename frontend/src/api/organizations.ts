import { request } from "./client";

export interface Member {
  id: string;
  email: string;
  name?: string;
  role: "OWNER" | "MEMBER";
  createdAt: string;
  lastLogin?: string | null;
  updatedAt: string;
}

export interface InviteRequest {
  email: string;
  role?: "OWNER" | "MEMBER";
}

export interface Invite {
  id: string;
  email: string;
  role: "OWNER" | "MEMBER";
  expiresAt: string;
  createdAt: string;
}

export async function getMembers(organizationId: string) {
  return request<Member[]>(`/organizations/${organizationId}/members`);
}

export async function updateMemberRole(organizationId: string, userId: string, role: "OWNER" | "MEMBER") {
  return request<Member>(`/organizations/${organizationId}/members/${userId}/role`, {
    method: "PATCH",
    body: { role },
  });
}

export async function removeMember(organizationId: string, userId: string) {
  return request<{ message: string }>(`/organizations/${organizationId}/members/${userId}`, {
    method: "DELETE",
  });
}

export async function listInvites(organizationId: string) {
  return request<Invite[]>(`/organizations/${organizationId}/invites`);
}

export async function createInvite(organizationId: string, data: InviteRequest) {
  return request<{ id: string; email: string; role: string; expiresAt: string; inviteUrl: string }>(
    `/organizations/${organizationId}/invites`,
    {
      method: "POST",
      body: data,
    }
  );
}
