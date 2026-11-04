"use client";

export default function PortalLogout() {
  async function logout() {
    await fetch("/api/portal/logout", { method: "POST" });
    window.location.href = "/portal";
  }
  return (
    <button onClick={logout} className="text-[0.66rem] uppercase tracking-wider2 text-[#9a9aa3] hover:text-[#f4f4f2]">
      Salir
    </button>
  );
}
