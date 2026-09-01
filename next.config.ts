import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // PGlite ships a WASM build of PostgreSQL. It must stay external to the
  // server bundle so the .wasm/.data assets resolve from node_modules at runtime.
  serverExternalPackages: ['@electric-sql/pglite'],
  typescript: {
    ignoreBuildErrors: false,
  },
}

export default nextConfig
