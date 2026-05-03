import type { NextConfig } from "next";

// `output: "standalone"` is required for Docker (copies only runtime files).
// Vercel sets VERCEL=1 and manages its own output format — standalone must be off there.
const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : "standalone",
  // Some browsers / PWAs request `/icon` (no extension). Serve the PNG from `public/`.
  async rewrites() {
    return [{ source: "/icon", destination: "/icon.png" }];
  },
};

export default nextConfig;
