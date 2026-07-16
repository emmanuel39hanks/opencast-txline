/**
 * Backend HTTP client.
 *
 * Responsibilities:
 *   - prefix every request with NEXT_PUBLIC_BACKEND_URL (default localhost:3001)
 *   - attach Privy bearer token (if available) to every request
 *   - parse JSON, throw typed ApiError on non-2xx
 *   - tolerate backend outage: caller can catch + render fallback UI
 *
 * Keep this file free of React — it's plain fetch.
 */

// Same-origin by default — data now comes from this app's own /api routes.
export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

export class ApiError extends Error {
  status: number;
  body?: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

type Method = "GET" | "POST" | "PATCH" | "DELETE" | "PUT";

interface RequestOptions {
  method?: Method;
  /** JSON-serialised body. */
  body?: unknown;
  /** If true, won't attempt to send Authorization header. */
  anonymous?: boolean;
  /** AbortSignal passthrough for TanStack cancellation. */
  signal?: AbortSignal;
  /** Extra headers. */
  headers?: Record<string, string>;
}

async function resolveToken(): Promise<string | null> {
  // Auth is handled by the Solana wallet + server routes; no bearer token here.
  return null;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, anonymous = false, signal, headers = {} } = options;
  const url = path.startsWith("http")
    ? path
    : `${BACKEND_URL}${path.startsWith("/") ? path : `/${path}`}`;

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...headers,
  };
  if (body !== undefined) finalHeaders["Content-Type"] = "application/json";

  if (!anonymous) {
    const token = await resolveToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
      credentials: "omit",
    });
  } catch (e) {
    // Network failure — backend unreachable, DNS error, offline, CORS.
    const msg = e instanceof Error ? e.message : "Network error";
    throw new ApiError(0, `Backend unreachable (${msg})`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await res.json().catch(() => null) : await res.text().catch(() => "");

  if (!res.ok) {
    const message =
      (isJson && payload && typeof payload === "object" && "message" in (payload as object)
        ? String((payload as { message: unknown }).message)
        : undefined) ??
      (typeof payload === "string" && payload.length ? payload : `HTTP ${res.status}`);
    throw new ApiError(res.status, message, payload);
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method">) =>
    apiRequest<T>(path, { ...opts, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method">) =>
    apiRequest<T>(path, { ...opts, method: "PATCH", body }),
  del: <T>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...opts, method: "DELETE" }),
};
