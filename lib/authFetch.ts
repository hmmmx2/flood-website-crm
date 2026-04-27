/**
 * authFetch — fetch wrapper for CRM BFF API routes.
 *
 * On 401/403 (expired access token), it calls silentRefresh() once,
 * updates the Authorization header, and retries the request.
 * If the retry also fails auth, the token is considered fully expired
 * and the user will be redirected to /login by AuthContext.
 */

type SilentRefreshFn = () => Promise<string | null>;

export async function authFetch(
  url: string,
  token: string,
  silentRefresh: SilentRefreshFn,
  options: RequestInit = {}
): Promise<Response> {
  const makeRequest = (t: string) =>
    fetch(url, {
      ...options,
      cache: "no-store",
      headers: {
        ...(options.headers ?? {}),
        Authorization: `Bearer ${t}`,
      },
    });

  let res = await makeRequest(token);

  // On auth failure, try to silently refresh once then retry
  if (res.status === 401 || res.status === 403) {
    const newToken = await silentRefresh();
    if (newToken) {
      res = await makeRequest(newToken);
    }
  }

  return res;
}
