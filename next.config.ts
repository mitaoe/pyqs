import type { NextConfig } from "next"

const nextConfig: NextConfig = {
    /* config options here */
    eslint: {
        // Disable ESLint during builds - we'll run it in GitHub Actions instead
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    // Suppress hydration warnings caused by browser extensions in development
    reactStrictMode: true,
    logging: {
        fetches: {
            fullUrl: true,
        },
    },
}

export default nextConfig
