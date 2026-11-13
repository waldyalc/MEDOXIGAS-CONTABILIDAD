import { redirect } from "next/navigation";

import { getPerfil } from "@/lib/auth/rol";
import { getFacturasLista } from "@/lib/facturacion/consultas";

import { FacturasTabla } from "./_components/facturas-tabla";

export default async function Page() {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const facturas = await getFacturasLista();

  return <FacturasTabla facturas={facturas} puedeEscribir={perfil.rol !== "lector"} />;
}
