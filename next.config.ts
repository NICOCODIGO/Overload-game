import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static build — every game runs client-side. Amplify serves /out as-is.
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
