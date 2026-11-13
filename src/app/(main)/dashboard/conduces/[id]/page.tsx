import { notFound, redirect } from "next/navigation";

import { VistaDocumentoVenta } from "@/components/documento-venta/vista-documento-venta";
import { getPerfil } from "@/lib/auth/rol";
import { getRemisionVista } from "@/lib/conduces/consultas";
import { getPlantillaImpresion } from "@/lib/plantillas-impresion/consultas";

import { DocumentoPapel } from "../../cotizaciones/_components/documento-papel";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const { id } = await params;
  const [vista, plantilla] = await Promise.all([getRemisionVista(id), getPlantillaImpresion("conduce")]);
  if (!vista) notFound();

  return (
    <VistaDocumentoVenta
      tipo="conduce"
      datos={vista}
      puedeEscribir={perfil.rol !== "lector"}
      papel={<DocumentoPapel tipo="remision" vista={vista} mostrarLogo={plantilla.mostrarLogo} />}
    />
  );
}
