import Link from "next/link";

export default function NotFound() {
  return (
    <section className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-7xl font-light tracking-wider2 text-bone">
        404
      </p>
      <p className="mt-4 text-sm uppercase tracking-wider2 text-ash">
        Esta página no existe
      </p>
      <Link
        href="/"
        className="mt-10 border-b border-bone/40 pb-1 text-[0.72rem] uppercase tracking-wider2 text-bone transition-colors hover:border-bone"
      >
        Volver al inicio
      </Link>
    </section>
  );
}
