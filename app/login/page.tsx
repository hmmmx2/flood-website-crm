"use client";

/**
 * CRM operator sign-in.
 *
 * Two-panel layout mirroring the community login page so the auth
 * experience feels unified across both apps. On mobile the hero
 * collapses and the form takes the full width.
 *
 * Security boundary: /api/auth/login (the CRM proxy) rejects any
 * non-operator role server-side BEFORE returning tokens to the
 * browser (see H.4 in the hardening plan addendum). A Customer
 * account submitting valid credentials gets a 403 with no tokens.
 * The form renders that 403 as a friendly "Not authorised" banner.
 *
 * `?error=` query support (H.7):
 *   - role     — the auth-callback rejected a non-operator
 *   - expired  — the AuthContext fired silentRefresh and it failed,
 *                or the Edge middleware found the cookie missing /
 *                expired / signature-invalid
 *   - callback — community → CRM handoff was malformed
 *
 * The community SSO fallback link stays (for operators who already
 * have a community session), but it's a plain `<a>` — no auto
 * redirect. Cross-origin nav only happens on explicit click.
 */

import { useEffect, useMemo, useState, type FormEvent, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import type { User } from "@/lib/AuthContext";

const ERROR_MESSAGES: Record<string, string> = {
  role:
    "This account is not authorised for CRM access. " +
    "Please use the community website for end-user features.",
  expired: "Your session expired — please sign in again.",
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

function LoginPageInner() {
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

      const payload = body as LoginSuccessResponse;
      const crmUser: User = {
        id: payload.user.id,
        name:
          payload.user.displayName ?? payload.user.name ?? payload.user.email,
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

      const callbackUrl = searchParams?.get("callbackUrl");
      window.location.href = callbackUrl ?? "/dashboard";
    } catch {
      setError("Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-very-light-grey dark:bg-dark-bg">
      <div className="flex flex-1">
        {/* ── Left panel — hero image (desktop only) ───────────────── */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
          <div className="absolute inset-0">
            <Image
              src="/images/flood-background.jpeg"
              alt="Flood monitoring control room"
              fill
              sizes="50vw"
              className="object-cover"
              priority
            />
            {/* Same gradient as the community login so the auth flow
                feels unified across both apps. */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(135deg, rgba(30,58,138,0.7) 0%, rgba(29,78,216,0.5) 50%, rgba(8,145,178,0.5) 100%)",
              }}
            />
          </div>
          <div className="relative z-10 flex flex-1 flex-col justify-center items-center text-center px-12">
            <div className="drop-shadow-lg">
              <Image
                src="/images/logo.png"
                alt="Pop Up Advertising And Information Enterprise"
                width={100}
                height={100}
                className="mx-auto mb-6"
                priority
              />
              <h1 className="text-3xl font-bold text-white mb-3">
                FloodWatch CRM
              </h1>
              <p className="text-base text-white/90 max-w-sm mx-auto">
                Operator console for live IoT sensor fleet, flood alerts, and
                community moderation across Sabah.
              </p>
            </div>
          </div>
        </div>

        {/* ── Right panel — form ────────────────────────────────────── */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-md rounded-3xl border border-light-grey bg-pure-white p-8 shadow-lg dark:border-dark-border dark:bg-dark-card">
            {/* Logo (mobile only) */}
            <div className="flex justify-center mb-6 lg:hidden">
              <Image
                src="/images/logo.png"
                alt="Pop Up Advertising And Information Enterprise"
                width={80}
                height={80}
                priority
              />
            </div>

            <h2 className="text-2xl font-semibold mb-2 text-dark-charcoal dark:text-dark-text">
              Operator Sign-in
            </h2>
            <p className="text-sm mb-6 text-dark-charcoal/60 dark:text-dark-text-muted">
              Restricted to admin, operations, field technician, NGO volunteer,
              and viewer roles.
            </p>

            {error && (
              <div
                role="alert"
                className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium mb-2 text-dark-charcoal dark:text-dark-text"
                >
                  Email Address
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
                  placeholder="operator@example.com"
                  className="w-full rounded-xl border border-light-grey bg-very-light-grey px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary-blue focus:ring-2 focus:ring-primary-blue/30 disabled:opacity-60 text-dark-charcoal placeholder:text-dark-charcoal/40 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text dark:placeholder:text-dark-text-muted"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium mb-2 text-dark-charcoal dark:text-dark-text"
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
                    placeholder="Enter your password"
                    className="w-full rounded-xl border border-light-grey bg-very-light-grey px-4 py-2.5 pr-16 text-sm outline-none transition-colors focus:border-primary-blue focus:ring-2 focus:ring-primary-blue/30 disabled:opacity-60 text-dark-charcoal placeholder:text-dark-charcoal/40 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text dark:placeholder:text-dark-text-muted"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium transition-colors text-dark-charcoal/60 hover:text-dark-charcoal dark:text-dark-text-muted dark:hover:text-dark-text"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-primary-blue px-4 py-2.5 text-sm font-semibold text-pure-white transition hover:bg-primary-blue/90 focus:outline-none focus:ring-2 focus:ring-primary-blue/50 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-dark-card"
              >
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </form>

            {/* Community SSO fallback — explicit click only, no auto nav */}
            <p className="mt-6 text-sm text-center text-dark-charcoal/60 dark:text-dark-text-muted">
              Already signed in on the community site?{" "}
              <a
                href={`${communityUrl}/login`}
                className="font-semibold text-primary-blue transition hover:opacity-80"
              >
                Use community SSO
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Map a raw Java backend role string ("ADMIN", "OPERATIONS_MANAGER",
 * etc.) to the CRM display label AuthContext expects. Mirrors the
 * ROLE_MAP in app/layout.tsx; an unrecognised role passes through
 * so the downstream isOperatorRole check rejects it cleanly.
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

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-very-light-grey dark:bg-dark-bg">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-light-grey border-t-primary-blue" />
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}
