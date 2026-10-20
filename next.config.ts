import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  reactStrictMode: true,
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/papers",
          has: [{ type: "query", key: "subject", value: "(?<subject>[^%?#]+)" }],
          destination: "/papers/:subject",
        },
      ],
      afterFiles: [],
      fallback: [],
    }
  },
}

export default nextConfig
