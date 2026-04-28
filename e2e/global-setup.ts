import { request } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const JAVA_API = 'http://localhost:4002';

/**
 * Global setup — runs once before all tests.
 * Logs in via Java API and writes flood_* tokens to .auth-state.json
 * so every test starts with an authenticated CRM session (via storageState).
 */
async function globalSetup() {
  const ctx = await request.newContext();

  const res = await ctx.post(`${JAVA_API}/auth/login`, {
    data: { email: 'admin@example.com', password: 'Admin@123' },
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok()) {
    throw new Error(`Global setup login failed: ${res.status()} ${await res.text()}`);
  }

  const data = await res.json();
  // Java API returns { session: { accessToken, refreshToken }, user: { id, email, displayName, role } }
  const session = data.session ?? data;
  const u = data.user ?? data;

  // Mirror toLocalUser() in AuthContext — role must be capitalized (e.g. "Admin")
  const rawRole = u.role ?? 'admin';
  const capitalizedRole = rawRole.charAt(0).toUpperCase() + rawRole.slice(1);

  const user = {
    id: u.id ?? '',
    name: u.displayName ?? u.email ?? 'admin@example.com',
    email: u.email ?? 'admin@example.com',
    role: capitalizedRole,  // "Admin" — matches rolePermissions key
    status: 'active',
  };

  const storageState = {
    cookies: [],
    origins: [
      {
        origin: 'http://localhost:3000',
        localStorage: [
          { name: 'flood_access_token', value: session.accessToken },
          { name: 'flood_refresh_token', value: session.refreshToken },
          { name: 'flood_auth_user', value: JSON.stringify(user) },
        ],
      },
    ],
  };

  const stateFile = path.resolve(__dirname, '.auth-state.json');
  fs.writeFileSync(stateFile, JSON.stringify(storageState, null, 2));
  console.log(`\n✓ Auth state saved → ${stateFile}`);

  await ctx.dispose();
}

export default globalSetup;
