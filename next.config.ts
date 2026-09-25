import type { NextConfig } from "next"

const nextConfig: NextConfig = {
    typescript: {
        ignoreBuildErrors: true,
    },
    reactStrictMode: true,
    // onnxruntime (pulled in by @huggingface/transformers) ships native
    // binaries that must not be bundled — used by the RAG assistant's
    // in-process query-time embeddings.
    serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node"],
    // ...but "not bundled" is not the same as "shipped". onnxruntime's .node
    // binding dlopen()s libonnxruntime.so.1 from its own bin/ directory, and
    // Next's tracer follows require() calls, not dlopen, so the .so was left
    // out of the function and every import of the embedding stack died on
    // Vercel with "libonnxruntime.so.1: cannot open shared object file".
    // Force-include the Linux x64 binaries (the only platform Vercel functions
    // run) for the one route that embeds at request time. The glob tolerates
    // onnxruntime-node version bumps; keep it in step with the installed
    // version if pnpm's layout ever changes.
    outputFileTracingIncludes: {
        "/api/ask": [
            "./node_modules/.pnpm/onnxruntime-node@*/node_modules/onnxruntime-node/bin/napi-v3/linux/x64/**",
        ],
    },
    logging: {
        fetches: {
            fullUrl: true,
        },
    },
}

export default nextConfig
