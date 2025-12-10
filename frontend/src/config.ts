const DEFAULT_API_BASE = "http://localhost:3000/api";

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? DEFAULT_API_BASE;
