// Server-side portfolio data source.
// Reads images from Cloudinary by tag (one tag per category slug) and falls
// back to local placeholders in /public/portfolio/<slug> when Cloudinary is
// not configured or a request fails. Runs only on the server.

import { CATEGORIES, LOCAL_SHAPES } from "@/lib/site";

const CLOUD = process.env.CLOUDINARY_CLOUD_NAME;
const KEY = process.env.CLOUDINARY_API_KEY;
const SECRET = process.env.CLOUDINARY_API_SECRET;
const ENABLED = Boolean(CLOUD && KEY && SECRET);

// Optimized delivery URL (auto format + quality, never upscaled past width).
function cldUrl(publicId, width) {
  return `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto,c_limit,w_${width}/${publicId}`;
}

async function fetchByTag(tag) {
  const auth = Buffer.from(`${KEY}:${SECRET}`).toString("base64");
  const url = `https://api.cloudinary.com/v1_1/${CLOUD}/resources/image/tags/${encodeURIComponent(
    tag
  )}?max_results=100`;

  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
    // Cache for an hour; new uploads appear after revalidation.
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Cloudinary responded ${res.status}`);

  const data = await res.json();
  return (data.resources || []).map((r) => ({
    id: r.public_id,
    src: cldUrl(r.public_id, 1100), // grid thumbnail
    full: cldUrl(r.public_id, 2000), // lightbox
    width: r.width,
    height: r.height,
    optimized: false, // already optimized by Cloudinary
  }));
}

function localItems(slug) {
  return LOCAL_SHAPES.map(([width, height], i) => {
    const file = `${String(i + 1).padStart(2, "0")}.jpg`;
    const src = `/portfolio/${slug}/${file}`;
    return { id: src, src, full: src, width, height, optimized: true };
  });
}

export async function getCategoryItems(cat) {
  if (ENABLED) {
    try {
      const items = await fetchByTag(cat.slug);
      if (items.length) {
        return items.map((it) => decorate(it, cat));
      }
    } catch (err) {
      console.warn(
        `[cloudinary] tag "${cat.slug}" failed (${err.message}); using local fallback.`
      );
    }
  }
  return localItems(cat.slug).map((it) => decorate(it, cat));
}

function decorate(item, cat) {
  return { ...item, category: cat.slug, alt: `${cat.title} — Stroka Visual` };
}

// All categories with their items, for the portfolio page.
export async function getPortfolio() {
  const lists = await Promise.all(CATEGORIES.map((c) => getCategoryItems(c)));
  return CATEGORIES.map((c, i) => ({ ...c, items: lists[i] }));
}
