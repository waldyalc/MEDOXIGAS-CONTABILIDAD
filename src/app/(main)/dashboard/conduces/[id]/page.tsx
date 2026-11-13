import { notFound, redirect } from "next/navigation";

import { DocumentoPapel } from "@/components/documento-venta/documento-papel";
import { VistaDocumentoVenta } from "@/components/documento-venta/vista-documento-venta";
import { getPerfil } from "@/lib/auth/rol";
import { getRemisionVista } from "@/lib/conduces/consultas";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const { id } = await params;
  const vista = await getRemisionVista(id);
  if (!vista) notFound();

  return (
    <VistaDocumentoVenta
      tipo="conduce"
      datos={vista}
      puedeEscribir={perfil.rol !== "lector"}
      papel={<DocumentoPapel tipo="conduce" vista={vista} />}
    />
  );
}
