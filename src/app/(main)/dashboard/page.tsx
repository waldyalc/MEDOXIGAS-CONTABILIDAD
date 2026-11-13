import { redirect } from "next/navigation";

import { getRol } from "@/lib/auth/rol";

export default async function Page() {
  const rol = await getRol();
  if (rol === "admin") redirect("/dashboard/produccion");
  if (rol === "caja") redirect("/dashboard/caja-chica");
  if (rol === "cobros") redirect("/dashboard/estado-cuenta");
  redirect("/unauthorized");
}
