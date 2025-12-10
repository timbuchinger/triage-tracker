import { request } from "./client";

export type IncidentSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type IncidentStatus = "OPEN" | "INVESTIGATING" | "MITIGATED" | "RESOLVED";

export interface Incident {
  id: string;
  refId: string;
  title: string;
  description?: string | null;
  severity: IncidentSeverity;
  status: IncidentStatus;
  serviceId?: string | null;
  service?: {
    id: string;
    name: string;
  } | null;
  owner?: {
    id: string;
    name?: string | null;
    email: string;
  } | null;
  slackChannelId?: string | null;
  createdAt: string;
}

export interface TimelineEvent {
  id: string;
  type: string;
  timestamp: string;
  message?: string | null;
  slackTs?: string | null;
  slackUser?: string | null;
  metadata?: unknown;
}

export interface IncidentSummary {
  id: string;
  content: string;
  generatedAt: string;
  metadata?: {
    provider?: string;
    model?: string;
    manuallyEdited?: boolean;
    editedAt?: string;
  };
}

export interface IncidentWithRelations extends Incident {
  timeline: TimelineEvent[];
  summaries: IncidentSummary[];
}

export async function listIncidents(filters?: {
  statuses?: IncidentStatus[];
  dateRange?: "7" | "30" | "90" | "all";
  owner?: "me" | "everyone";
  userId?: string; // optional helper for tests/dev when auth is not wired
}) {
  const params = new URLSearchParams();

  if (filters?.statuses && filters.statuses.length) {
    for (const s of filters.statuses) params.append("status", s);
  }

  if (filters?.dateRange) params.set("dateRange", filters.dateRange);
  if (filters?.owner) params.set("owner", filters.owner);
  if (filters?.userId) params.set("userId", filters.userId);

  const path = "/incidents" + (params.toString() ? `?${params.toString()}` : "");
  return request<Incident[]>(path);
}

export async function createIncident(input: {
  title: string;
  description?: string;
  severity: IncidentSeverity;
  serviceId?: string;
}) {
  return request<Incident>("/incidents", {
    method: "POST",
    body: input
  });
}

export async function getIncident(refId: string) {
  return request<IncidentWithRelations>(`/incidents/${encodeURIComponent(refId)}`);
}

export async function updateIncident(refId: string, input: {
  title?: string;
  description?: string;
  severity?: IncidentSeverity;
  serviceId?: string;
}) {
  return request<Incident>(`/incidents/${encodeURIComponent(refId)}`, {
    method: "PATCH",
    body: input
  });
}

export async function generateSummary(refId: string) {
  return request<IncidentSummary>(`/incidents/${encodeURIComponent(refId)}/summaries/generate`, {
    method: "POST"
  });
}

export async function updateSummary(refId: string, summaryId: string, content: string) {
  return request<IncidentSummary>(`/incidents/${encodeURIComponent(refId)}/summaries/${summaryId}`, {
    method: "PATCH",
    body: { content }
  });
}
