import { API_BASE_URL } from "@/config";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export async function request<T>(path: string, options: { method?: HttpMethod; body?: any } = {}) {
  const headers: Record<string, string> = {};

  // Only set Content-Type when there is a body to send. This avoids adding
  // unnecessary request headers for GET requests which can trigger CORS
  // preflight checks when not needed in some dev setups.
  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    credentials: "include", // Include cookies for refresh token
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed with status ${response.status}`);
  }

  // Handle empty responses (204 No Content) or non-JSON responses gracefully
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    // If the response has no JSON body, return undefined
    return undefined as unknown as T;
  }

  return (await response.json()) as T;
}
