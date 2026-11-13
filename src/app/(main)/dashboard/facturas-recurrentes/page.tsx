import { redirect } from "next/navigation";

import { getPerfil } from "@/lib/auth/rol";
import { getFacturasRecurrentesLista } from "@/lib/facturas-recurrentes/consultas";

import { FacturasRecurrentesTabla } from "./_components/facturas-recurrentes-tabla";

export default async function Page() {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const recurrentes = await getFacturasRecurrentesLista();

  return <FacturasRecurrentesTabla recurrentes={recurrentes} puedeEscribir={perfil.rol !== "lector"} />;
}
