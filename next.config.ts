import type { NextConfig } from "next"

const SAFE = "[^%?#/]"
const SAFE_NOT_DOT = "[^%?#/.]"
const SINGLE_PATH_SEGMENT = `(?<subject>(?:${SAFE_NOT_DOT}${SAFE}*|\\.${SAFE_NOT_DOT}${SAFE}*|\\.\\.${SAFE}+))`

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
          has: [{ type: "query", key: "subject", value: SINGLE_PATH_SEGMENT }],
          destination: "/papers/:subject",
        },
      ],
      afterFiles: [],
      fallback: [],
    }
  },
}

export default nextConfig
