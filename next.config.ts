import type { NextConfig } from "next"

const nextConfig: NextConfig = {
    typescript: {
        ignoreBuildErrors: true,
    },
    reactStrictMode: true,
    logging: {
        fetches: {
            fullUrl: true,
        },
    },
}

export default nextConfig
