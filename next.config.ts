import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  images: { unoptimized: true },
  serverExternalPackages: ['googleapis', 'google-auth-library'],
};
export default nextConfig;
