import { existsSync } from "node:fs"
import { resolve } from "node:path"
import type { NextConfig } from "next"

// The shared .env lives at the repo root (same file the FastAPI app reads), but
// Next only loads .env files from apps/web itself. Load the root file here so
// NEXT_PUBLIC_API_URL reaches the client bundle — otherwise it silently falls
// back to localhost:8000, which a phone on the LAN cannot reach.
const rootEnv = resolve(import.meta.dirname, "../../.env")
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv)

const nextConfig: NextConfig = {
  // lucide-react ships one module per icon: without this the whole set lands
  // in every page bundle.
  experimental: { optimizePackageImports: ["lucide-react"] },
  // In the Docker build the pnpm layout hides next/package.json from the inferred
  // root, so point Turbopack at the monorepo root explicitly.
  turbopack: { root: resolve(import.meta.dirname, "../..") },
  // Self-contained server for the Docker image (server.js + traced node_modules).
  output: "standalone",
  transpilePackages: ["@workspace/ui"],
  // Dev-only: allow the LAN origin so a phone on the same Wi-Fi can load /_next assets.
  allowedDevOrigins: ["192.168.1.20"],
}

export default nextConfig
