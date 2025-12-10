import { request } from "./client";

export interface TeamSummary {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { services?: number; incidents?: number };
}

export interface TeamMember {
  id: string;
  user: { id: string; email: string; name?: string };
}

export interface Service {
  id: string;
  name: string;
  createdAt: string;
}

export interface TeamDetail extends TeamSummary {
  primaryContact?: { id: string; email: string; name?: string } | null;
  secondaryContact?: { id: string; email: string; name?: string } | null;
  members: TeamMember[];
  services: Service[];
}

export async function listTeams(organizationId: string) {
  return request<TeamSummary[]>(`/teams?organizationId=${encodeURIComponent(organizationId)}`);
}

export async function getTeam(id: string) {
  return request<TeamDetail>(`/teams/${id}`);
}

export async function getDefaultTeam(organizationId: string) {
  return request<TeamDetail>(`/teams/default?organizationId=${encodeURIComponent(organizationId)}`);
}

export async function createTeam(data: { name: string; organizationId: string; isDefault?: boolean; primaryContactId?: string; secondaryContactId?: string; memberIds?: string[] }) {
  return request<TeamDetail>(`/teams`, { method: "POST", body: data });
}

export async function updateTeam(id: string, data: { name?: string; isDefault?: boolean; primaryContactId?: string | null; secondaryContactId?: string | null; memberIds?: string[], serviceIds?: string[] }) {
  return request<TeamDetail>(`/teams/${id}`, { method: "PUT", body: data });
}

export async function deleteTeam(id: string) {
  return request<{ message: string }>(`/teams/${id}`, { method: "DELETE" });
}

export async function addMembers(teamId: string, memberIds: string[]) {
  return request<TeamDetail>(`/teams/${teamId}/members`, { method: "POST", body: { memberIds } });
}

export async function removeMember(teamId: string, userId: string) {
  return request<TeamDetail>(`/teams/${teamId}/members/${userId}`, { method: "DELETE" });
}
