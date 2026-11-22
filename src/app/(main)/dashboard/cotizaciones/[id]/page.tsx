import { notFound, redirect } from "next/navigation";

import { DocumentoPapel } from "@/components/documento-venta/documento-papel";
import { VistaDocumentoVenta } from "@/components/documento-venta/vista-documento-venta";
import { TicketPos } from "@/components/pos/ticket-pos";
import { getPerfil } from "@/lib/auth/rol";
import { getDocumentoVista } from "@/lib/cotizaciones/consultas";
import { getPlantillaImpresion } from "@/lib/plantillas-impresion/consultas";
import { armarTicketCotizacionVista } from "@/lib/pos/impresion";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const { id } = await params;
  const [vista, plantilla] = await Promise.all([
    getDocumentoVista("cotizacion", id),
    getPlantillaImpresion("cotizacion"),
  ]);
  if (!vista) notFound();

  // Ticket de 80 mm con la plantilla por defecto del POS (la de la terminal
  // solo existe en el POS; aquí no hay terminal seleccionada).
  const ticket = armarTicketCotizacionVista(vista);

  return (
    <VistaDocumentoVenta
      tipo="cotizacion"
      datos={vista}
      puedeEscribir={perfil.rol !== "lector"}
      papel={<DocumentoPapel tipo="cotizacion" vista={vista} mostrarLogo={plantilla.mostrarLogo} />}
      ticket={{
        titulo: `cotizacion-${vista.documento.numero}`,
        ancho: ticket.diseno.ancho_mm,
        nodo: <TicketPos payload={ticket} />,
      }}
    />
  );
}
