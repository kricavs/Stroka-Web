import Hero from "@/components/Hero";
import { getFeaturedProjects } from "@/lib/portfolio";

export default function Home() {
  // Portfolio-cover home: image as protagonist, nav on top, minimal text.
  // Slides come from the featured projects (content/portfolio/proyectos).
  const slides = getFeaturedProjects().map((p) => ({
    slug: p.slug,
    title: p.title,
    category: p.category.title,
    year: p.year,
    image: p.hero,
  }));
  return <Hero slides={slides} />;
}
