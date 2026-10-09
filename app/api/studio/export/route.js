import { guardApi } from "@/lib/studio/server/auth";
import { exportAll } from "@/lib/studio/server/budgets";

export const runtime = "nodejs";

// JSON backup of every budget (download from the studio list screen).
export async function GET() {
  const denied = await guardApi();
  if (denied) return denied;
  const body = JSON.stringify({ exportedAt: new Date().toISOString(), budgets: await exportAll() }, null, 2);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="stroka-presupuestos-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
