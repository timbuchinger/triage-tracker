import { request } from "./client";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name?: string;
    organizationId: string;
    role: string;
  };
}

export interface RefreshResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name?: string;
    organizationId: string;
    role: string;
  };
}

export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  return request<LoginResponse>("/auth/login", {
    method: "POST",
    body: credentials,
  });
}

export async function logout(): Promise<void> {
  await request<void>("/auth/logout", {
    method: "POST",
  });
}

export async function refreshToken(): Promise<RefreshResponse> {
  return request<RefreshResponse>("/auth/refresh", {
    method: "POST",
  });
}
