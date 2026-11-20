import { notFound, redirect } from "next/navigation";

import {
  type CampoInformacionDocumento,
  DocumentoDetalle,
  type EstadoDetalle,
  InformacionDocumento,
  TablaDocumento,
  TarjetaDocumento,
} from "@/components/documento/documento-detalle";
import { Enlace } from "@/components/enlace";
import { FilaNavegable } from "@/components/listas/fila-navegable";
import { TableCell } from "@/components/ui/table";
import { getRol } from "@/lib/auth/rol";
import { rutaProducto } from "@/lib/enlaces";
import { getEmpresa } from "@/lib/facturacion/consultas";
import { formatoDia } from "@/lib/formato";
import { obtenerTransferencia } from "@/lib/inventario/consultas";
import { formatoCantidad } from "@/lib/productos/productos";

import { AccionesTransferencia } from "./_components/acciones-transferencia";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const [transferencia, empresa] = await Promise.all([obtenerTransferencia(id), getEmpresa()]);
  if (!transferencia) notFound();

  const estado: EstadoDetalle =
    transferencia.estado === "anulada" ? { etiqueta: "Anulada", tono: "red" } : { etiqueta: "Activa", tono: "green" };

  const informacion: CampoInformacionDocumento[] = [
    { etiqueta: "Fecha", valor: formatoDia(transferencia.fecha) },
    { etiqueta: "Origen", valor: transferencia.origen_nombre },
    { etiqueta: "Destino", valor: transferencia.destino_nombre },
    {
      etiqueta: "Observaciones",
      valor: <span className="whitespace-pre-line">{transferencia.observaciones?.trim() || "—"}</span>,
    },
  ];

  return (
    <DocumentoDetalle
      rutaVolver="/dashboard/inventario/transferencias"
      etiquetaVolver="Volver a transferencias"
      titulo={`Transferencia #${transferencia.numero}`}
      estado={estado}
      acciones={
        rol !== "lector" && transferencia.estado === "activa" ? (
          <AccionesTransferencia transferenciaId={transferencia.id} numero={transferencia.numero} />
        ) : null
      }
    >
      <TarjetaDocumento empresa={empresa} numeroDocumento={String(transferencia.numero)}>
        <InformacionDocumento titulo="Información de la transferencia" campos={informacion} columnas={2} />

        <TablaDocumento
          titulo="Productos transferidos"
          columnas={[{ titulo: "Producto" }, { titulo: "Cantidad", alineadaDerecha: true }]}
          vacio="La transferencia no tiene productos."
          hayFilas={transferencia.lineas.length > 0}
        >
          {transferencia.lineas.map((linea) => (
            <FilaNavegable key={linea.id} href={rutaProducto(linea.producto_id)}>
              <TableCell className="h-12 px-4 text-sm font-medium whitespace-normal">
                <Enlace href={rutaProducto(linea.producto_id)}>{linea.producto_nombre}</Enlace>
              </TableCell>
              <TableCell className="h-12 px-4 text-right text-sm tabular-nums">
                {formatoCantidad(linea.cantidad)}
              </TableCell>
            </FilaNavegable>
          ))}
        </TablaDocumento>
      </TarjetaDocumento>
    </DocumentoDetalle>
  );
}
