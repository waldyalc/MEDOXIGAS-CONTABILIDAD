import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { BookOpen } from "lucide-react";

import {
  type CampoInformacionDocumento,
  CLASE_BOTON_DOCUMENTO,
  DocumentoDetalle,
  type EstadoDetalle,
  InformacionDocumento,
  type ItemResumenDetalle,
  TablaDocumento,
  TarjetaDocumento,
} from "@/components/documento/documento-detalle";
import { Enlace } from "@/components/enlace";
import { FilaNavegable } from "@/components/listas/fila-navegable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell } from "@/components/ui/table";
import { getRol } from "@/lib/auth/rol";
import { rutaAsiento, rutaProducto } from "@/lib/enlaces";
import { getEmpresa } from "@/lib/facturacion/consultas";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";
import { obtenerAjuste } from "@/lib/inventario/consultas";
import { formatoCantidad } from "@/lib/productos/productos";

import { AccionesAjuste } from "./_components/acciones-ajuste";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const [ajuste, empresa] = await Promise.all([obtenerAjuste(id), getEmpresa()]);
  if (!ajuste) notFound();

  const estado: EstadoDetalle =
    ajuste.estado === "anulada" ? { etiqueta: "Anulado", tono: "red" } : { etiqueta: "Activo", tono: "green" };

  const informacion: CampoInformacionDocumento[] = [
    { etiqueta: "Fecha", valor: formatoDia(ajuste.fecha) },
    { etiqueta: "Almacén", valor: ajuste.almacen_nombre },
    {
      etiqueta: "Observaciones",
      valor: <span className="whitespace-pre-line">{ajuste.observaciones?.trim() || "—"}</span>,
    },
  ];

  const resumen: ItemResumenDetalle[] = [
    { etiqueta: "Total ajustado", valor: formatoMoneda(ajuste.total) },
    { etiqueta: "Productos", valor: String(ajuste.lineas.length) },
  ];

  return (
    <DocumentoDetalle
      rutaVolver="/dashboard/inventario/ajustes"
      etiquetaVolver="Volver a ajustes de inventario"
      titulo={`Ajuste de inventario #${ajuste.numero}`}
      estado={estado}
      acciones={
        <>
          {ajuste.asiento_id ? (
            <Button
              variant="outline"
              className={CLASE_BOTON_DOCUMENTO}
              render={<Link href={rutaAsiento(ajuste.asiento_id)} prefetch={false} />}
            >
              <BookOpen data-icon="inline-start" />
              Ver asiento
            </Button>
          ) : null}
          {rol !== "lector" && ajuste.estado === "activo" ? (
            <AccionesAjuste ajusteId={ajuste.id} numero={ajuste.numero} />
          ) : null}
        </>
      }
      resumen={resumen}
    >
      <TarjetaDocumento empresa={empresa} numeroDocumento={String(ajuste.numero)}>
        <InformacionDocumento titulo="Información del ajuste" campos={informacion} columnas={2} />

        <TablaDocumento
          titulo="Productos ajustados"
          columnas={[
            { titulo: "Producto" },
            { titulo: "Tipo" },
            { titulo: "Cantidad", alineadaDerecha: true },
            { titulo: "Costo unitario", alineadaDerecha: true },
            { titulo: "Total", alineadaDerecha: true },
          ]}
          vacio="El ajuste no tiene productos."
          hayFilas={ajuste.lineas.length > 0}
        >
          {ajuste.lineas.map((linea) => (
            <FilaNavegable key={linea.id} href={rutaProducto(linea.producto_id)}>
              <TableCell className="h-12 px-4 text-sm font-medium whitespace-normal">
                <Enlace href={rutaProducto(linea.producto_id)}>{linea.producto_nombre}</Enlace>
              </TableCell>
              <TableCell className="h-12 px-4 text-sm">
                <Badge variant={linea.tipo === "entrada" ? "default" : "secondary"}>
                  {linea.tipo === "entrada" ? "Entrada" : "Salida"}
                </Badge>
              </TableCell>
              <TableCell className="h-12 px-4 text-right text-sm tabular-nums">
                {formatoCantidad(linea.cantidad)}
              </TableCell>
              <TableCell className="h-12 px-4 text-right text-sm tabular-nums">
                {formatoMoneda(linea.costo_unitario)}
              </TableCell>
              <TableCell className="h-12 px-4 text-right text-sm font-medium tabular-nums">
                {formatoMoneda(linea.total)}
              </TableCell>
            </FilaNavegable>
          ))}
        </TablaDocumento>
      </TarjetaDocumento>
    </DocumentoDetalle>
  );
}
