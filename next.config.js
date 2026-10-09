/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Allow Cloudinary-delivered images through next/image.
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
  experimental: {
    // Server-only database drivers must not be bundled.
    serverComponentsExternalPackages: ["pg", "@electric-sql/pglite"],
  },
  webpack: (config) => {
    // pdf.js optionally requires the Node "canvas" package; never needed in the browser.
    config.resolve.alias.canvas = false;
    return config;
  },
  async headers() {
    const privateHeaders = [
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet" },
      { key: "Cache-Control", value: "private, no-store" },
    ];
    return [
      { source: "/studio/:path*", headers: privateHeaders },
      { source: "/api/studio/:path*", headers: privateHeaders },
    ];
  },
};

module.exports = nextConfig;
