"use client";

export default function LogoutButton() {
  async function logout() {
    await fetch("/api/studio/logout", { method: "POST" });
    window.location.href = "/studio/login";
  }
  return (
    <button onClick={logout} className="uppercase tracking-wider2 hover:text-bone">
      Salir
    </button>
  );
}
