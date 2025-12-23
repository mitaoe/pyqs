import type { NextConfig } from "next"

const nextConfig: NextConfig = {
    eslint: {
        // Disable ESLint during builds - we'll run it in GitHub Actions instead
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    reactStrictMode: true,
    logging: {
        fetches: {
            fullUrl: true,
        },
    },
    // Turbopack configuration (replaces webpack config)
    turbopack: {
        resolveAlias: {
            "pdfjs-dist/build/pdf.worker.entry": "pdfjs-dist/build/pdf.worker.min.mjs",
        },
    },
    // Keep webpack config for production builds (non-Turbopack)
    webpack: (config, { isServer }) => {
        if (!isServer) {
            config.resolve.alias = {
                ...config.resolve.alias,
                "pdfjs-dist/build/pdf.worker.entry": "pdfjs-dist/build/pdf.worker.min.mjs",
            }
        }
        return config
    },
    // Ensure static files are served correctly
    async headers() {
        return [
            {
                source: "/pdf.worker.min.mjs",
                headers: [
                    {
                        key: "Content-Type",
                        value: "application/javascript",
                    },
                ],
            },
        ]
    },
}

export default nextConfig
