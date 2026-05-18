"use client";

/**
 * CRM-native credentials sign-in.
 *
 * Replaces the previous cross-port redirect to community + the
 * dev-only forged-JWT button (DevPreviewSignIn). Operators sign in
 * here directly: email + password → POST /api/auth/login → CRM
 * receives the Java JWT and stores tokens in localStorage under the
 * same keys AuthContext already reads on mount.
 *
 * Security boundary: /api/auth/login (the CRM proxy) rejects any
 * non-operator role server-side BEFORE returning tokens to the
 * browser (see H.4 in the hardening plan addendum). A Customer
 * account submitting valid credentials gets a 403 with no tokens.
 * The form renders that 403 as a friendly "Not authorised" banner.
 *
 * `?error=` query support (H.7):
 *   - role:     the auth-callback rejected a non-operator
 *   - expired:  the AuthContext fired silentRefresh and it failed
 *   - callback: community → CRM handoff was malformed
 *
 * The community sign-in fallback link stays (for operators who'd
 * rather use SSO through community), but it is plain `<a>` — no
 * automatic redirect. Cross-port nav only happens on explicit click.
 */

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { User } from "@/lib/AuthContext";

const ERROR_MESSAGES: Record<string, string> = {
  role:
    "Your account is not authorised for CRM access. " +
    "Please use the community website for end-user features.",
  expired:
    "Your session expired — please sign in again.",
  callback:
    "Sign-in failed during the community redirect. Try again, " +
    "or sign in directly below.",
};

type LoginSuccessResponse = {
  session: { accessToken: string; refreshToken: string };
  user: {
    id: string;
    email: string;
    displayName?: string;
    name?: string;
    avatarUrl?: string;
    role: string;
  };
};

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const errorCode = searchParams?.get("error");
  const initialError = useMemo(
    () => (errorCode ? (ERROR_MESSAGES[errorCode] ?? null) : null),
    [errorCode],
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  // Refresh the inline banner when the URL changes (router.push
  // back to /login?error=... while the page is already mounted).
  useEffect(() => {
    if (errorCode) setError(ERROR_MESSAGES[errorCode] ?? "Sign in failed.");
  }, [errorCode]);

  const communityUrl =
    process.env.NEXT_PUBLIC_COMMUNITY_URL || "http://localhost:3002";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
        // Required for the httpOnly cookie set by the route to be
        // attached to the response on same-origin POST — the default
        // changed in some browsers; being explicit avoids surprises.
        credentials: "include",
      });
      const body = (await res.json().catch(() => ({}))) as
        | LoginSuccessResponse
        | { error?: string };

      if (!res.ok) {
        const msg =
          "error" in body && typeof body.error === "string"
            ? body.error
            : res.status === 401
              ? "Invalid email or password."
              : res.status === 403
                ? ERROR_MESSAGES.role
                : "Sign in failed. Please try again.";
        setError(msg);
        return;
      }

      // Success — write tokens + user in the shape AuthContext expects.
      // Keep this list in lockstep with `flood-website-crm/lib/AuthContext.tsx`.
      const payload = body as LoginSuccessResponse;
      const crmUser: User = {
        id: payload.user.id,
        name: payload.user.displayName ?? payload.user.name ?? payload.user.email,
        email: payload.user.email,
        avatarUrl: payload.user.avatarUrl,
        role: normaliseRoleForCrm(payload.user.role),
        status: "active",
        twoFactorEnabled: false,
        passwordLastChanged: new Date().toISOString(),
        notifications: true,
        emailAlerts: true,
        smsAlerts: false,
      };
      localStorage.setItem("flood_access_token", payload.session.accessToken);
      localStorage.setItem("flood_refresh_token", payload.session.refreshToken);
      localStorage.setItem("flood_auth_user", JSON.stringify(crmUser));

      // Hard navigation so AuthContext re-reads localStorage in its
      // mount-effect (router.push doesn't trigger that init flow).
      const callbackUrl = searchParams?.get("callbackUrl");
      window.location.href = callbackUrl ?? "/dashboard";
    } catch {
      setError("Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-200 p-6 text-slate-800 dark:from-slate-900 dark:to-slate-950 dark:text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-5 w-5"
            >
              <path
                fillRule="evenodd"
                d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold">CRM sign-in</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Operator-only console
            </p>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          >
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400"
            >
              Work email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              placeholder="operator@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-16 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-slate-900"
          >
            {loading ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                >
                  <path
                    d="M12 4a8 8 0 1 0 8 8"
                    strokeLinecap="round"
                  />
                </svg>
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        {/* Secondary: community SSO link */}
        <div className="mt-6 border-t border-slate-200 pt-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
          <p>
            Already signed in on the community site?{" "}
            <a
              href={`${communityUrl}/login`}
              className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              Use community SSO instead
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}

/**
 * Map a raw Java backend role string ("ADMIN", "OPERATIONS_MANAGER",
 * etc.) to the CRM display label AuthContext expects ("Admin",
 * "Operations Manager", etc.). Mirrors the ROLE_MAP in
 * app/layout.tsx so the two paths agree on labels.
 *
 * If the role isn't recognised we keep it as-is so the
 * isOperatorRole() check downstream rejects it cleanly rather than
 * silently coercing to a valid role.
 */
function normaliseRoleForCrm(rawRole: string): string {
  const key = String(rawRole || "").trim().toUpperCase().replace(/\s+/g, "_");
  switch (key) {
    case "ADMIN":
      return "Admin";
    case "OPERATIONS_MANAGER":
    case "OPERATIONSMANAGER":
      return "Operations Manager";
    case "FIELD_TECHNICIAN":
    case "FIELDTECHNICIAN":
      return "Field Technician";
    case "NGO_VOLUNTEER":
    case "NGOVOLUNTEER":
      return "NGO Volunteer";
    case "VIEWER":
      return "Viewer";
    case "CUSTOMER":
      return "Customer";
    default:
      return rawRole;
  }
}
