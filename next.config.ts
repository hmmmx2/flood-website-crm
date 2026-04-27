import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Required for Docker — outputs a self-contained server in .next/standalone
  output: "standalone",
  turbopack: {
    root: path.resolve(__dirname, "../.."),  // monorepo root (FYP/)
  },
};

export default nextConfig;
