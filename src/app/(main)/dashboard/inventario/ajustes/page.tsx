import { redirect } from "next/navigation";

import { getRol } from "@/lib/auth/rol";
import { listarAjustes } from "@/lib/inventario/consultas";

import { AjustesTabla } from "./_components/ajustes-tabla";

export default async function Page() {
  const rol = await getRol();
  if (rol === null) redirect("/unauthorized");

  const ajustes = await listarAjustes();

  return <AjustesTabla ajustes={ajustes} puedeEscribir={rol !== "lector"} />;
}
