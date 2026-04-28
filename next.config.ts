import type { NextConfig } from "next";

/**
 * Docker: `output: standalone` publishes `.next/standalone` for the Node runtime image.
 *
 * Omit monorepo `turbopack.root` here so builds work when the Docker context is only `flood-website-crm/`.
 */
const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
