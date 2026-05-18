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
};

export default nextConfig;
