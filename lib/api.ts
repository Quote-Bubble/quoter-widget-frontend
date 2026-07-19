/**
 * Base URL for the quoter-api backend.
 *
 * The frontend and backend live in separate repositories and deployments, so
 * every request to /api/... goes through this helper. Locally, run
 * quoter-api on port 3001 and set NEXT_PUBLIC_QUOTER_API_URL accordingly
 * (see .env.example). If the variable is unset, requests fall back to the
 * current origin, which only works when both apps are served together.
 */
const base = (process.env.NEXT_PUBLIC_QUOTER_API_URL ?? "").replace(/\/+$/, "");

export function apiUrl(path: string): string {
  return `${base}${path}`;
}
