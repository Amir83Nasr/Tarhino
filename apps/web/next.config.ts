import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui"],
  // Dev-only: allow the LAN origin so a phone on the same Wi-Fi can load /_next assets.
  allowedDevOrigins: ["192.168.1.20"],
}

export default nextConfig
