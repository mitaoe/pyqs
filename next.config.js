/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Handle PDF.js worker
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "pdfjs-dist/build/pdf.worker.entry":
          "pdfjs-dist/build/pdf.worker.min.mjs",
      };
    }

    return config;
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
    ];
  },
};

module.exports = nextConfig;
