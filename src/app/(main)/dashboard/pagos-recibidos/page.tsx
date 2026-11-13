import { redirect } from "next/navigation";

import { getPerfil } from "@/lib/auth/rol";
import { getPagosLista } from "@/lib/pagos/consultas";

import { PagosTabla } from "./_components/pagos-tabla";

export default async function Page() {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const pagos = await getPagosLista();

  return <PagosTabla pagos={pagos} puedeEscribir={perfil.rol !== "lector"} />;
}
