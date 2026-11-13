import { redirect } from "next/navigation";

import { getPerfil } from "@/lib/auth/rol";
import { getRemisionesLista } from "@/lib/conduces/consultas";

import { DocumentosTabla } from "../cotizaciones/_components/documentos-tabla";

export default async function Page() {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const documentos = await getRemisionesLista();

  return <DocumentosTabla tipo="remision" documentos={documentos} puedeEscribir={perfil.rol !== "lector"} />;
}
