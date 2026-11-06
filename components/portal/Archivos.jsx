import { groupFiles } from "@/lib/portal/files-core.js";
import { listFiles } from "@/lib/portal/server/files";
import { FileGroup } from "./FileList";
import { Eyebrow, Title, card } from "./ui";

export default async function Archivos({ scope, fileHref }) {
  const sections = groupFiles(await listFiles(scope));
  return (
    <>
      <Eyebrow>Archivos</Eyebrow>
      <Title>Tus archivos</Title>
      {sections.length === 0 ? (
        <p className={`${card} mt-8 p-6 text-sm font-light text-[#9a9aa3]`}>Todavía no hay archivos disponibles. Cuando tengamos algo para vos, lo vas a encontrar acá.</p>
      ) : (
        <div className="mt-8 space-y-10">
          {sections.map((s) => (
            <section key={s.category}>
              <h2 className="mb-4 text-[0.66rem] font-semibold uppercase tracking-[0.3em] text-[var(--accent)]">{s.label}</h2>
              <ul className="space-y-3">{s.groups.map((g) => <FileGroup key={g.key} group={g} fileHref={fileHref} />)}</ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
