import { redirect } from "next/navigation";

import { getPerfil } from "@/lib/auth/rol";
import { getGastosLista } from "@/lib/gastos/consultas";

import { GastosTabla } from "./_components/gastos-tabla";

export default async function Page() {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const gastos = await getGastosLista();

  return <GastosTabla gastos={gastos} puedeEscribir={perfil.rol !== "lector"} />;
}
