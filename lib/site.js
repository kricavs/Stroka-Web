// Central configuration: brand, logo, contact and portfolio categories.

export const SITE = {
  name: "Stroka Visual",
  tagline: "Productora audiovisual",

  // --- LOGO ---------------------------------------------------------------
  // Replace /public/logo-stroka.svg with your real file (PNG or SVG).
  // Easiest: keep the same filename and just overwrite the file.
  // Or drop /public/logo-stroka.png and set logoSrc to "/logo-stroka.png".
  // Set logoWidth/logoHeight to your file's real ratio so it never deforms.
  logoSrc: "/logo-stroka.png",
  logoWidth: 1000,
  logoHeight: 250,

  // --- CONTACT ------------------------------------------------------------
  instagram: "stroka.visual",
  instagramUrl: "https://instagram.com/stroka.visual",
  email: "contacto@strokavisual.com",
  // Replace with the real number in international format, e.g. "5493815551234"
  whatsapp: "0000000000",
  whatsappUrl: "https://wa.me/0000000000",
};

// Portfolio categories. The `slug` doubles as the Cloudinary tag.
export const CATEGORIES = [
  { slug: "fotografia", title: "Fotografía", blurb: "Imagen comercial, producto y retrato." },
  { slug: "video", title: "Video", blurb: "Piezas con narrativa y montaje cinematográfico." },
  { slug: "drone", title: "Drone", blurb: "Tomas aéreas para territorio y arquitectura." },
  { slug: "eventos", title: "Eventos", blurb: "Cobertura integral de eventos." },
  { slug: "marcas", title: "Marcas", blurb: "Contenido y campañas de marca." },
  { slug: "institucional", title: "Institucional", blurb: "Producción para empresas e instituciones." },
  { slug: "webs-rebrandings", title: "Webs y rebrandings", blurb: "Identidad visual y presencia digital." },
];

// Intrinsic sizes of the local placeholder files (public/portfolio/<slug>/0N.jpg).
// Used as fallback when Cloudinary is not configured.
export const LOCAL_SHAPES = [
  [1200, 1500],
  [1500, 1000],
  [1200, 1200],
  [1000, 1400],
  [1600, 900],
  [1300, 1100],
];

export function getCategory(slug) {
  return CATEGORIES.find((c) => c.slug === slug);
}
