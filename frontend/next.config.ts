import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev();
}

const nextConfig: NextConfig = {
  experimental: {
    externalDir: true,
    optimizePackageImports: ["@chakra-ui/react"],
  },
};

export default nextConfig;
