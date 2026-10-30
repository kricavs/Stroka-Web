"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { MAX_WORK } from "@/lib/home-shared";
import { Button, Section } from "./ui";
import FocalEditor from "./FocalEditor";

const DEFAULT_CROP = { focalX: 50, focalY: 50, zoom: 1 };

function readSize(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => resolve({});
    img.src = url;
  });
}

// Horizontal strip of library thumbnails to choose from.
function Picker({ images, value, onPick, allowNone, noneLabel }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {allowNone && (
        <button
          type="button"
          onClick={() => onPick(null)}
          className={`h-16 w-24 shrink-0 border px-2 text-[0.58rem] uppercase leading-tight tracking-wider2 ${
            !value ? "border-champagne text-champagne" : "border-edge text-ash hover:border-ash"
          }`}
        >
          {noneLabel}
        </button>
      )}
      {images.map((img) => (
        <button
          key={img.id}
          type="button"
          onClick={() => onPick(img.id)}
          className={`h-16 w-24 shrink-0 overflow-hidden border ${
            value === img.id ? "border-champagne" : "border-edge opacity-70 hover:opacity-100"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.url} alt="" className="h-full w-full object-cover" />
        </button>
      ))}
      {!images.length && <p className="text-sm text-ash">Todavía no hay imágenes en la biblioteca.</p>}
    </div>
  );
}

export default function HomeEditor({ projects, initialImages, uploadEnabled, initial }) {
  const [images, setImages] = useState(initialImages);
  const [hero, setHero] = useState(initial.hero);
  const [contact, setContact] = useState(initial.contact);
  const [work, setWork] = useState(initial.work);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  const fileRef = useRef(null);

  const byId = (id) => images.find((i) => i.id === id);
  const projectBy = (slug) => projects.find((p) => p.slug === slug);
  const flash = (type, text) => setMsg({ type, text });

  async function onFiles(e) {
    const files = [...e.target.files];
    e.target.value = "";
    if (!files.length) return;
    setMsg(null);
    for (const file of files) {
      setBusy(`Subiendo ${file.name}…`);
      try {
        const blob = await upload(`home/${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/studio/blob-upload",
        });
        const size = await readSize(file);
        const res = await fetch("/api/studio/site/images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: blob.url, pathname: blob.pathname, ...size }),
        });
        if (!res.ok) throw new Error("No se pudo registrar la imagen.");
        const { image } = await res.json();
        setImages((l) => [image, ...l]);
      } catch (err) {
        flash("error", `${file.name}: ${err.message || "falló la subida."}`);
        break;
      }
    }
    setBusy("");
  }

  async function removeImage(id) {
    if (!confirm("¿Eliminar esta imagen de la biblioteca?")) return;
    const res = await fetch(`/api/studio/site/images/${id}`, { method: "DELETE" });
    if (res.ok) setImages((l) => l.filter((i) => i.id !== id));
    else flash("error", (await res.json().catch(() => ({}))).error || "No se pudo eliminar.");
  }

  async function save() {
    setBusy("Guardando…");
    setMsg(null);
    const res = await fetch("/api/studio/site/home", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hero, contact, work }),
    });
    setBusy("");
    if (res.ok) flash("ok", "Cambios guardados. El inicio ya los muestra.");
    else flash("error", ((await res.json().catch(() => ({}))).errors || ["No se pudo guardar."]).join(" "));
  }

  const move = (i, d) =>
    setWork((w) => {
      const j = i + d;
      if (j < 0 || j >= w.length) return w;
      const c = [...w];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
  const patchWork = (i, patch) => setWork((w) => w.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const available = projects.filter((p) => !work.some((w) => w.projectSlug === p.slug));

  const single = (title, hint, value, set, aspect) => (
    <Section title={title}>
      <p className="mb-3 max-w-xl text-sm text-ash">{hint}</p>
      <Picker
        images={images}
        value={value?.imageId}
        allowNone
        noneLabel="Sin imagen"
        onPick={(id) => set(id ? { ...(value || DEFAULT_CROP), imageId: id } : null)}
      />
      {value && byId(value.imageId) && (
        <FocalEditor
          url={byId(value.imageId).url}
          value={value}
          onChange={(v) => set(v)}
          aspect={aspect}
        />
      )}
    </Section>
  );

  return (
    <div className="mt-10 space-y-12">
      <Section title="Biblioteca de imágenes">
        {uploadEnabled ? (
          <div className="mb-4 flex items-center gap-4">
            <Button type="button" variant="solid" disabled={!!busy} onClick={() => fileRef.current?.click()}>
              Subir imágenes
            </Button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple hidden onChange={onFiles} />
            <span className="text-xs text-ash">JPG, PNG, WebP o AVIF · hasta 15 MB cada una.</span>
          </div>
        ) : (
          <p role="status" className="mb-4 max-w-xl border border-edge p-3 text-sm text-ash">
            Las subidas no están disponibles: falta conectar Vercel Blob al proyecto (variable BLOB_READ_WRITE_TOKEN).
            Podés seguir usando las imágenes ya cargadas; el inicio funciona con las de respaldo.
          </p>
        )}
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
          {images.map((img) => (
            <div key={img.id} className="group relative aspect-[4/3] overflow-hidden border border-edge">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(img.id)}
                className="absolute inset-x-0 bottom-0 bg-ink/85 py-1 text-[0.58rem] uppercase tracking-wider2 text-[#d49a92] opacity-0 transition-opacity group-hover:opacity-100"
              >
                Eliminar
              </button>
            </div>
          ))}
        </div>
      </Section>

      {single(
        "Imagen principal (hero)",
        "Una sola imagen fija, independiente de la portada y del hero de cada proyecto.",
        hero,
        setHero,
        "16 / 9"
      )}

      <Section
        title={`Selected Work (${work.length}/${MAX_WORK})`}
        aside={
          work.length < MAX_WORK && available.length > 0 ? (
            <select
              value=""
              onChange={(e) => e.target.value && setWork((w) => [...w, { projectSlug: e.target.value, imageId: null, ...DEFAULT_CROP }])}
              className="border border-edge bg-panel px-2 py-1.5 text-xs text-ash focus:border-champagne focus:outline-none"
            >
              <option value="">+ Agregar proyecto</option>
              {available.map((p) => (
                <option key={p.slug} value={p.slug}>{p.title}</option>
              ))}
            </select>
          ) : null
        }
      >
        {!work.length && (
          <p className="text-sm text-ash">
            Sin proyectos elegidos: el inicio muestra los proyectos destacados con su portada como respaldo.
          </p>
        )}
        <div className="space-y-8">
          {work.map((w, i) => {
            const p = projectBy(w.projectSlug);
            const img = byId(w.imageId);
            return (
              <div key={w.projectSlug} className="border border-edge p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm">
                    <span className="mr-3 text-champagne">{String(i + 1).padStart(2, "0")}</span>
                    {p?.title || w.projectSlug}
                    {p && <span className="ml-3 text-xs text-ash">{p.category}</span>}
                  </p>
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir">↑</Button>
                    <Button type="button" variant="ghost" disabled={i === work.length - 1} onClick={() => move(i, 1)} aria-label="Bajar">↓</Button>
                    <Button type="button" variant="danger" onClick={() => setWork((l) => l.filter((_, k) => k !== i))}>Quitar</Button>
                  </div>
                </div>
                <div className="mt-3">
                  <Picker
                    images={images}
                    value={w.imageId}
                    allowNone
                    noneLabel="Portada del proyecto"
                    onPick={(id) => patchWork(i, { imageId: id, ...DEFAULT_CROP })}
                  />
                </div>
                <FocalEditor
                  url={img ? img.url : p?.cover}
                  value={w}
                  onChange={(v) => patchWork(i, v)}
                  aspect="4 / 3"
                  label={img ? "imagen del home" : "portada (respaldo)"}
                />
              </div>
            );
          })}
        </div>
      </Section>

      {single(
        "Imagen del bloque final / contacto",
        "Fondo del llamado a la acción antes del footer.",
        contact,
        setContact,
        "16 / 9"
      )}

      <div className="sticky bottom-0 -mx-5 flex items-center gap-4 border-t border-edge bg-ink/95 px-5 py-4 backdrop-blur md:-mx-8 md:px-8">
        <Button type="button" variant="solid" disabled={!!busy} onClick={save}>Guardar cambios</Button>
        {busy && <span className="text-sm text-ash">{busy}</span>}
        {msg && (
          <span role="status" className={`text-sm ${msg.type === "ok" ? "text-champagne" : "text-red-400"}`}>{msg.text}</span>
        )}
      </div>
    </div>
  );
}
