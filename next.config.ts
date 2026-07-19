import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static build — every game runs client-side. Amplify serves /out as-is.
  output: "export",
  images: { unoptimized: true },
  // Let phones on the local network load the dev server's JS bundles —
  // without this, Next blocks cross-origin dev requests and the site renders
  // but nothing is clickable on other devices.
  allowedDevOrigins: ["192.168.1.119", "192.168.56.1", "192.168.1.*"],
};

export default nextConfig;
