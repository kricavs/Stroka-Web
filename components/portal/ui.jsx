import { STATUS_COLOR } from "@/lib/shared/content.js";

export const card = "border border-[#2a2a31] bg-[#1d1d22]";

export function Eyebrow({ children }) {
  return <p className="text-[0.66rem] font-light uppercase tracking-[0.3em] text-[var(--accent)]">{children}</p>;
}

export function Title({ children }) {
  return <h1 className="mt-2 font-title text-4xl uppercase leading-none tracking-wide sm:text-5xl">{children}</h1>;
}

export function StatusPill({ status, label }) {
  return (
    <span className="inline-flex items-center gap-2 text-[0.64rem] uppercase tracking-wider2 text-[#c9c9cf]">
      <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[status] }} />
      {label}
    </span>
  );
}
