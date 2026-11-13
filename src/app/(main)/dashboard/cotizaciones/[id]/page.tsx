import { notFound, redirect } from "next/navigation";

import { getPerfil } from "@/lib/auth/rol";
import { getDocumentoVista } from "@/lib/cotizaciones/consultas";

import { VistaDocumento } from "../_components/vista-documento";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const { id } = await params;
  const vista = await getDocumentoVista("cotizacion", id);
  if (!vista) notFound();

  return <VistaDocumento tipo="cotizacion" vista={vista} puedeEscribir={perfil.rol !== "lector"} />;
}
