import { redirect } from "next/navigation";

import { getPerfil } from "@/lib/auth/rol";
import { getDocumentosLista } from "@/lib/cotizaciones/consultas";

import { DocumentosTabla } from "./_components/documentos-tabla";

export default async function Page() {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const documentos = await getDocumentosLista("cotizacion");

  return <DocumentosTabla tipo="cotizacion" documentos={documentos} puedeEscribir={perfil.rol !== "lector"} />;
}
