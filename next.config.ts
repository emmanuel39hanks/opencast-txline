import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pin the workspace root to this project so Turbopack doesn't get confused by
  // an unrelated lockfile in a parent directory.
  turbopack: {
    root: path.resolve(),
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
