// Use relative path so Vite dev server proxy forwards requests to the API
// during local development. This keeps requests same-origin and avoids CORS.
const DEFAULT_API_BASE = "/api";

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? DEFAULT_API_BASE;
