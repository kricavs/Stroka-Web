// The private studio and client portal are never meant to be crawled. (No sitemap exists; if one
// is added later, never list /studio or /portal routes in it.)
export default function robots() {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/studio", "/api/studio", "/portal", "/api/portal"] }],
  };
}
