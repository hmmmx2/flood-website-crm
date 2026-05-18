"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { roleFromJwtOrApiRole } from "@/lib/permissions";

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const at = params.get("at");
    const rt = params.get("rt");
    const u = params.get("u");

    if (!at || !rt || !u) {
      router.replace("/login");
      return;
    }

    try {
      const raw = JSON.parse(decodeURIComponent(u));

      // Transform community AuthUser → CRM User shape so AuthContext
      // reads it correctly. Critical: role must be capitalized ("Admin")
      // to match rolePermissions keys in lib/permissions.ts.
      const crmUser = {
        id: raw.id,
        name: raw.displayName || raw.name || raw.email,
        email: raw.email,
        role: roleFromJwtOrApiRole(String(raw.role ?? "CUSTOMER")),
        status: "active",
        twoFactorEnabled: false,
        passwordLastChanged: new Date().toISOString(),
        notifications: true,
        emailAlerts: true,
        smsAlerts: false,
      };

      const accessToken = decodeURIComponent(at);
      const refreshToken = decodeURIComponent(rt);
      localStorage.setItem("flood_access_token", accessToken);
      localStorage.setItem("flood_refresh_token", refreshToken);
      localStorage.setItem("flood_auth_user", JSON.stringify(crmUser));
      // Strip the access/refresh tokens from the URL bar BEFORE navigating
      // away — otherwise the tokens linger in browser history.
      window.history.replaceState({}, "", "/auth/callback");

      // Ask the server to set httpOnly auth cookies. The server
      // re-validates the role (defence-in-depth — the pre-hydration
      // script also gates non-operator roles, but we never trust a
      // single check). On 403 we wipe the localStorage we just wrote
      // and bounce to /login?error=role; on 200 we proceed to the
      // dashboard with both cookie + localStorage in sync.
      fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, refreshToken }),
        credentials: "include",
      })
        .then((res) => {
          if (res.ok) {
            router.replace("/dashboard");
          } else if (res.status === 403) {
            localStorage.removeItem("flood_access_token");
            localStorage.removeItem("flood_refresh_token");
            localStorage.removeItem("flood_auth_user");
            router.replace("/login?error=role");
          } else {
            router.replace("/login?error=callback");
          }
        })
        .catch(() => {
          router.replace("/login?error=callback");
        });
    } catch {
      window.history.replaceState({}, "", "/auth/callback");
      router.replace("/login");
    }
  }, [params, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
      <div className="text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 mx-auto mb-4" />
        <p className="text-sm text-gray-500">Setting up your session…</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}><p>Loading...</p></div>}>
      <CallbackInner />
    </Suspense>
  );
}
