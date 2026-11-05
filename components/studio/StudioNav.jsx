"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import LogoutButton from "./LogoutButton";

const GROUPS = [
  {
    title: "Operación",
    items: [
      { href: "/studio", label: "Hoy", exact: true },
      { href: "/studio/clientes", label: "Clientes" },
      { href: "/studio/calendario", label: "Calendario" },
      { href: "/studio/tareas", label: "Tareas" },
    ],
  },
  {
    title: "Administración",
    items: [
      { href: "/studio/presupuestos", label: "Presupuestos" },
      { href: "/studio/sitio", label: "Sitio" },
      { href: "/studio/referencias", label: "Referencias", badge: true },
    ],
  },
];

function Links({ pending, path, onNavigate }) {
  return (
    <div className="space-y-7">
      {GROUPS.map((g) => (
        <div key={g.title}>
          <p className="mb-2 text-[0.58rem] font-medium uppercase tracking-[0.3em] text-ash/60">{g.title}</p>
          <ul className="space-y-0.5">
            {g.items.map((it) => {
              const active = it.href && (it.exact ? path === it.href : path.startsWith(it.href) || (it.href === "/studio/clientes" && path.startsWith("/studio/contenido")));
              return (
                <li key={it.label}>
                  {it.soon ? (
                    <span className="flex items-center justify-between px-3 py-2 text-[0.7rem] uppercase tracking-wider2 text-ash/40">
                      {it.label}
                      <span className="text-[0.52rem] tracking-wider">Próximamente</span>
                    </span>
                  ) : (
                    <Link
                      href={it.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center justify-between px-3 py-2 text-[0.7rem] font-light uppercase tracking-wider2 transition-colors ${
                        active ? "bg-graphite text-champagne" : "text-ash hover:text-champagne"
                      }`}
                    >
                      {it.label}
                      {it.badge && pending > 0 && (
                        <span className="bg-champagne px-1.5 py-0.5 text-[0.6rem] font-semibold text-ink">{pending}</span>
                      )}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

// variant="desktop": side column. variant="mobile": hamburger + drawer.
export default function StudioNav({ pending = 0, variant = "desktop" }) {
  const path = usePathname() || "";
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);

  if (variant === "desktop") {
    return (
      <aside className="w-52 shrink-0">
        <div className="sticky top-6">
          <Links pending={pending} path={path} />
          <div className="mt-8 border-t border-edge pt-4 text-[0.68rem] font-light text-ash">
            <LogoutButton />
          </div>
        </div>
      </aside>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir menú"
        aria-expanded={open}
        className="flex items-center gap-2 text-[0.68rem] uppercase tracking-wider2 text-ash"
      >
        <span className="relative flex h-3 w-4 flex-col justify-between"><i className="h-px bg-current" /><i className="h-px bg-current" /><i className="h-px bg-current" /></span>
        Menú
        {pending > 0 && <span className="bg-champagne px-1.5 py-0.5 text-[0.6rem] font-semibold text-ink">{pending}</span>}
      </button>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menú">
          <button className="absolute inset-0 bg-black/70" aria-label="Cerrar menú" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col bg-ink px-5 py-6 shadow-2xl">
            <button onClick={() => setOpen(false)} className="mb-6 self-end text-[0.68rem] uppercase tracking-wider2 text-ash hover:text-bone">Cerrar ✕</button>
            <Links pending={pending} path={path} onNavigate={() => setOpen(false)} />
            <div className="mt-auto border-t border-edge pt-4 text-[0.68rem] font-light text-ash"><LogoutButton /></div>
          </div>
        </div>
      )}
    </>
  );
}
