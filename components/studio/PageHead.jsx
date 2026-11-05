export default function PageHead({ eyebrow, title, children }) {
  return (
    <div className="mb-8">
      <p className="text-[0.7rem] font-light uppercase tracking-[0.3em] text-champagne">{eyebrow}</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-title text-5xl uppercase leading-none tracking-wide sm:text-6xl">{title}</h1>
        {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
      </div>
      <span className="mt-4 block h-px w-10 bg-champagne" />
    </div>
  );
}
