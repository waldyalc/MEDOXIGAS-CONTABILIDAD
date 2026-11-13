import { notFound, redirect } from "next/navigation";

import { VistaDocumentoVenta } from "@/components/documento-venta/vista-documento-venta";
import { getPerfil } from "@/lib/auth/rol";
import { getDocumentoVista } from "@/lib/cotizaciones/consultas";

import { DocumentoPapel } from "../_components/documento-papel";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const { id } = await params;
  const vista = await getDocumentoVista("cotizacion", id);
  if (!vista) notFound();

  return (
    <VistaDocumentoVenta
      tipo="cotizacion"
      datos={vista}
      puedeEscribir={perfil.rol !== "lector"}
      papel={<DocumentoPapel tipo="cotizacion" vista={vista} />}
    />
  );
}
