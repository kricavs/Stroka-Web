import { requireSession } from "@/lib/studio/server/auth";
import { listTestimonials } from "@/lib/studio/server/testimonials";
import TestimonialsAdmin from "@/components/studio/TestimonialsAdmin";

export default async function ReferencesPage() {
  await requireSession();
  const rows = await listTestimonials();
  return (
    <>
      <p className="text-[0.7rem] font-light uppercase tracking-[0.3em] text-champagne">Moderación</p>
      <h1 className="mt-2 font-title text-6xl uppercase leading-none tracking-wide">Referencias</h1>
      <span className="mt-4 block h-px w-10 bg-champagne" />
      <TestimonialsAdmin initial={JSON.parse(JSON.stringify(rows))} />
    </>
  );
}
