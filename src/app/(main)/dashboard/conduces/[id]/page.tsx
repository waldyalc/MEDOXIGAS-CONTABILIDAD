import { notFound, redirect } from "next/navigation";

import { getPerfil } from "@/lib/auth/rol";
import { getRemisionVista } from "@/lib/conduces/consultas";

import { VistaDocumento } from "../../cotizaciones/_components/vista-documento";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const { id } = await params;
  const vista = await getRemisionVista(id);
  if (!vista) notFound();

  return <VistaDocumento tipo="remision" vista={vista} puedeEscribir={perfil.rol !== "lector"} />;
}
