import { notFound, redirect } from "next/navigation";

import { DocumentoPapel } from "@/components/documento-venta/documento-papel";
import { VistaDocumentoVenta } from "@/components/documento-venta/vista-documento-venta";
import { getPerfil } from "@/lib/auth/rol";
import { getFacturaVista } from "@/lib/facturacion/consultas";
import { getPlantillaImpresion } from "@/lib/plantillas-impresion/consultas";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const { id } = await params;
  const [datos, plantilla] = await Promise.all([getFacturaVista(id), getPlantillaImpresion("factura")]);
  if (!datos) notFound();

  return (
    <VistaDocumentoVenta
      tipo="factura"
      datos={datos}
      puedeEscribir={perfil.rol !== "lector"}
      papel={
        <DocumentoPapel
          tipo="factura"
          empresa={datos.empresa}
          factura={datos.factura}
          lineas={datos.lineas}
          contacto={datos.contacto}
          ncfVence={datos.ncfVence}
          mostrarLogo={plantilla.mostrarLogo}
        />
      }
    />
  );
}
