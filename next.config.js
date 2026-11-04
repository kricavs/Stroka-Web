/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Home images uploaded from Studio live in Vercel Blob.
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
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
    // Client portal: per-client data, never cacheable or indexable.
    const portalHeaders = [
      ...privateHeaders,
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
    ];
    return [
      { source: "/studio/:path*", headers: privateHeaders },
      { source: "/api/studio/:path*", headers: privateHeaders },
      { source: "/portal/:path*", headers: portalHeaders },
      { source: "/api/portal/:path*", headers: portalHeaders },
    ];
  },
};

module.exports = nextConfig;
