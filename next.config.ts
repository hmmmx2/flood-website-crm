import type { NextConfig } from "next";

// `output: "standalone"` is required for Docker (copies only runtime files).
// Vercel sets VERCEL=1 and manages its own output format — standalone must be off there.
const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : "standalone",

  // Local preview tooling (Claude Code preview MCP, some IDE proxies) hits
  // the dev server on 127.0.0.1 rather than `localhost`. Next 16's default
  // cross-origin guard blocks HMR/RSC traffic from those hosts and silently
  // breaks client hydration. Allow the loopback variants explicitly in dev.
  allowedDevOrigins: ["127.0.0.1", "localhost"],

  // Some browsers / PWAs request `/icon` (no extension). Serve the PNG from `public/`.
  async rewrites() {
    return [{ source: "/icon", destination: "/icon.png" }];
  },

  // QA P1-11 — Baseline security headers for the operator console.
  // The CRM is more lockable than the community site (no third-party
  // embeds beyond Google Maps + Recharts), so we can be stricter:
  // - HSTS:              1 year + preload.
  // - X-Frame-Options:   DENY — operators should never embed the CRM
  //                      in another site; eliminates clickjacking surface
  //                      on sensitive actions (role changes, broadcasts).
  // - X-Content-Type-Options: nosniff — same justification as community.
  // - Referrer-Policy:   strict-origin-when-cross-origin — keeps paths
  //                      like `/admin/users/123` out of upstream
  //                      referrer logs when an operator clicks an
  //                      external link.
  // - Permissions-Policy: deny camera + microphone; geolocation `self`
  //                      because /map uses the browser geolocation API
  //                      to centre on the operator.
  // - Cross-Origin-Opener-Policy: same-origin — popup isolation.
  // - CSP:               Not set globally yet (Recharts inline styles
  //                      + Google Maps would need a tuned policy).
  //                      Captured as a follow-up.
  async headers() {
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "form-action 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://maps.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://maps.gstatic.com https://maps.googleapis.com https://*.googleusercontent.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://maps.googleapis.com https://maps.gstatic.com https://*.upstash.io",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
    ].join("; ");
    const securityHeaders = [
      { key: "Content-Security-Policy-Report-Only", value: csp },
      {
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains; preload",
      },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
      },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    ];
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
