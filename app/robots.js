// The private studio is never meant to be crawled. (No sitemap exists; if one
// is added later, never list /studio routes in it.)
export default function robots() {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/studio", "/api/studio"] }],
  };
}
