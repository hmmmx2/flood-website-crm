/**
 * authFetch — fetch wrapper for CRM BFF API routes.
 *
 * On 401/403 (expired access token), it calls silentRefresh() once,
 * updates the Authorization header, and retries the request.
 * If the retry also fails auth, the token is considered fully expired
 * and the user will be redirected to /login by AuthContext.
 */

type SilentRefreshFn = () => Promise<string | null>;

async function csrfHeader(method?: string): Promise<Record<string, string>> {
  const verb = (method ?? "GET").toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(verb)) return {};
  const res = await fetch("/api/auth/csrf", { cache: "no-store" });
  if (!res.ok) return {};
  const data = (await res.json()) as { csrfToken?: string };
  return data.csrfToken ? { "X-CSRF-Token": data.csrfToken } : {};
}

export async function authFetch(
  url: string,
  _token: string,
  silentRefresh: SilentRefreshFn,
  options: RequestInit = {}
): Promise<Response> {
  const extraHeaders = await csrfHeader(options.method);
  const makeRequest = () =>
    fetch(url, {
      ...options,
      cache: "no-store",
      headers: {
        ...(options.headers ?? {}),
        ...extraHeaders,
      },
      credentials: "same-origin",
    });

  let res = await makeRequest();

  // On auth failure, try to silently refresh once then retry
  if (res.status === 401 || res.status === 403) {
    const newToken = await silentRefresh();
    if (newToken) {
      res = await makeRequest();
    }
  }

  return res;
}

/** Error thrown when a BFF route returns a non-OK status (after refresh retry). */
export class BffRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "BffRequestError";
  }
}

/**
 * Same as {@link authFetch} but parses JSON and throws {@link BffRequestError} on failure.
 * Use for CRM CRUD calls so 401s trigger silent refresh consistently.
 */
export async function authFetchJson<T>(
  url: string,
  token: string,
  silentRefresh: SilentRefreshFn,
  options: RequestInit = {},
): Promise<T> {
  const res = await authFetch(url, token, silentRefresh, options);
  const ct = res.headers.get("content-type") ?? "";

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    if (ct.includes("application/json")) {
      try {
        const errBody = (await res.json()) as { error?: string; message?: string };
        if (typeof errBody?.error === "string") message = errBody.error;
        else if (typeof errBody?.message === "string") message = errBody.message;
      } catch {
        /* keep generic message */
      }
    }
    throw new BffRequestError(message, res.status);
  }

  if (res.status === 204) return undefined as T;

  if (!ct.includes("application/json")) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}
