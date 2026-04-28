import { Page } from '@playwright/test';

const JAVA_API = 'http://localhost:4002';

/**
 * Programmatic login — calls the Java API directly via page.request (no
 * browser navigation), then registers a page.addInitScript that injects
 * flood_* tokens into localStorage BEFORE any page JavaScript runs.
 *
 * This avoids the issue where page.goto('/') causes the CRM to redirect
 * to community login (port 3002), putting us on the wrong origin before
 * we can inject tokens.
 *
 * Call this BEFORE any page.goto() in the test / beforeEach.
 */
export async function loginAsAdmin(
  page: Page,
  email = 'admin@example.com',
  password = 'Admin@123'
) {
  // 1. Get tokens directly from Java API (no browser navigation)
  const res = await page.request.post(`${JAVA_API}/auth/login`, {
    data: { email, password },
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok()) {
    throw new Error(`Login API failed: ${res.status()} ${await res.text()}`);
  }

  const data = await res.json();
  // Java API returns { session: { accessToken, refreshToken }, user: { id, email, displayName, role } }
  const session = data.session ?? data;
  const u = data.user ?? data;

  const accessToken: string = session.accessToken;
  const refreshToken: string = session.refreshToken;

  // Mirror toLocalUser() in AuthContext — role must be capitalized (e.g. "Admin")
  const rawRole = u.role ?? 'admin';
  const capitalizedRole = rawRole.charAt(0).toUpperCase() + rawRole.slice(1);

  const user = {
    id: u.id ?? '',
    name: u.displayName ?? u.email ?? email,
    email: u.email ?? email,
    role: capitalizedRole,  // "Admin" — matches rolePermissions key
    status: 'active' as const,
  };

  // 2. Register init script — runs before any page JS on every navigation.
  //    CRM uses flood_* keys; community uses community_* keys, so injecting
  //    flood_* tokens on any origin is safe and harmless.
  await page.addInitScript(
    ({ at, rt, usr }) => {
      localStorage.setItem('flood_access_token', at);
      localStorage.setItem('flood_refresh_token', rt);
      localStorage.setItem('flood_auth_user', JSON.stringify(usr));
    },
    { at: accessToken, rt: refreshToken, usr: user }
  );
}
