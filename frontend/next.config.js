const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        // Backend dev port (see README). If the backend runs elsewhere the
        // browser-side fallback in src/lib/api.ts tries 8001 and 8000 directly.
        destination: "http://127.0.0.1:8001/api/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
