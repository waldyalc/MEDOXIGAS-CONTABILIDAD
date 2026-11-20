import { notFound, redirect } from "next/navigation";

import {
  type CampoInformacionDocumento,
  DocumentoDetalle,
  InformacionDocumento,
  type SeccionDocumento,
  SeccionesDocumento,
  TablaDocumento,
  TarjetaDocumento,
} from "@/components/documento/documento-detalle";
import { Enlace } from "@/components/enlace";
import { FilaNavegable } from "@/components/listas/fila-navegable";
import { Badge } from "@/components/ui/badge";
import { TableCell } from "@/components/ui/table";
import { getPerfil } from "@/lib/auth/rol";
import { rutaContacto, rutaFactura, rutaProducto } from "@/lib/enlaces";
import { calcularLinea, valorACentavos } from "@/lib/facturacion/calculo";
import { etiquetaTipoComprobante } from "@/lib/facturacion/comprobantes";
import { getEmpresa } from "@/lib/facturacion/consultas";
import { formatoCantidad, formatoMoneda, formatoMonedaCentavos } from "@/lib/facturacion/formato";
import { getFacturaRecurrenteVista } from "@/lib/facturas-recurrentes/consultas";
import { formatoDia } from "@/lib/formato";

import { BotonGenerar } from "./_components/boton-generar";

function frecuenciaTexto(meses: number) {
  return meses === 1 ? "Cada mes" : `Cada ${meses} meses`;
}

function etiquetaEstado(estado: string) {
  if (estado === "anulada") return "Anulada";
  if (estado === "pagada") return "Pagada";
  return "Abierta";
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const { id } = await params;
  const [recurrente, empresa] = await Promise.all([getFacturaRecurrenteVista(id), getEmpresa()]);
  if (!recurrente) notFound();

  const informacion: CampoInformacionDocumento[] = [
    {
      etiqueta: "Cliente",
      valor: <Enlace href={rutaContacto(recurrente.contacto_id)}>{recurrente.cliente_nombre}</Enlace>,
    },
    { etiqueta: "Comprobante", valor: etiquetaTipoComprobante(recurrente.tipo_comprobante) },
    { etiqueta: "Fecha de inicio", valor: formatoDia(recurrente.fecha_inicio) },
    {
      etiqueta: "Vigencia hasta",
      valor: recurrente.vigencia_hasta ? formatoDia(recurrente.vigencia_hasta) : "Sin límite",
    },
    { etiqueta: "Frecuencia", valor: frecuenciaTexto(recurrente.frecuencia_meses) },
    { etiqueta: "Plazo de pago", valor: `${recurrente.plazo_dias} días` },
    {
      etiqueta: "Observaciones",
      valor: recurrente.notas ? <span className="whitespace-pre-line">{recurrente.notas}</span> : "—",
    },
  ];

  const secciones: SeccionDocumento[] = [
    {
      valor: "generaciones",
      etiqueta: "Facturas generadas",
      contenido: (
        <TablaDocumento
          columnas={[
            { titulo: "Periodo" },
            { titulo: "Factura" },
            { titulo: "NCF" },
            { titulo: "Fecha" },
            { titulo: "Total", alineadaDerecha: true },
            { titulo: "Estado" },
          ]}
          vacio="Todavía no se ha generado ninguna factura."
          hayFilas={recurrente.generaciones.length > 0}
        >
          {recurrente.generaciones.map((generacion) => (
            <FilaNavegable key={generacion.id} href={rutaFactura(generacion.factura_id)}>
              <TableCell className="h-12 px-4 text-sm">{formatoDia(generacion.periodo)}</TableCell>
              <TableCell className="h-12 px-4 text-sm font-medium">
                <Enlace href={rutaFactura(generacion.factura_id)}>#{generacion.factura_numero}</Enlace>
              </TableCell>
              <TableCell className="h-12 px-4 font-mono text-xs">{generacion.factura_ncf ?? "—"}</TableCell>
              <TableCell className="h-12 px-4 text-sm">{formatoDia(generacion.factura_fecha)}</TableCell>
              <TableCell className="h-12 px-4 text-right text-sm tabular-nums">
                {formatoMoneda(generacion.factura_total)}
              </TableCell>
              <TableCell className="h-12 px-4 text-sm">
                <Badge variant={generacion.factura_estado === "anulada" ? "destructive" : "secondary"}>
                  {etiquetaEstado(generacion.factura_estado)}
                </Badge>
              </TableCell>
            </FilaNavegable>
          ))}
        </TablaDocumento>
      ),
    },
  ];

  return (
    <DocumentoDetalle
      rutaVolver="/dashboard/facturas-recurrentes"
      etiquetaVolver="Volver a facturas recurrentes"
      titulo={`Factura recurrente #${recurrente.numero}`}
      acciones={perfil.rol !== "lector" ? <BotonGenerar id={recurrente.id} /> : null}
    >
      <TarjetaDocumento empresa={empresa} numeroDocumento={String(recurrente.numero)}>
        <InformacionDocumento titulo="Información de la plantilla" campos={informacion} />

        <TablaDocumento
          titulo="Líneas de la plantilla"
          columnas={[
            { titulo: "Descripción" },
            { titulo: "Cantidad", alineadaDerecha: true },
            { titulo: "Precio", alineadaDerecha: true },
            { titulo: "Desc. %", alineadaDerecha: true },
            { titulo: "ITBIS %", alineadaDerecha: true },
            { titulo: "Total", alineadaDerecha: true },
          ]}
          vacio="La plantilla no tiene líneas."
          hayFilas={recurrente.lineas.length > 0}
        >
          {recurrente.lineas.map((linea) => {
            const calculo = calcularLinea({
              cantidad: linea.cantidad,
              precioCentavos: valorACentavos(linea.precio),
              descuentoPct: linea.descuento_pct,
              itbisTasa: linea.itbis_tasa,
            });
            return (
              <FilaNavegable key={linea.id} href={linea.producto_id ? rutaProducto(linea.producto_id) : null}>
                <TableCell className="h-12 px-4 text-sm font-medium">
                  {linea.producto_id ? (
                    <Enlace href={rutaProducto(linea.producto_id)}>{linea.descripcion}</Enlace>
                  ) : (
                    linea.descripcion
                  )}
                </TableCell>
                <TableCell className="h-12 px-4 text-right text-sm tabular-nums">
                  {formatoCantidad(linea.cantidad)}
                </TableCell>
                <TableCell className="h-12 px-4 text-right text-sm tabular-nums">
                  {formatoMoneda(linea.precio)}
                </TableCell>
                <TableCell className="h-12 px-4 text-right text-sm tabular-nums">
                  {formatoCantidad(linea.descuento_pct)}
                </TableCell>
                <TableCell className="h-12 px-4 text-right text-sm tabular-nums">
                  {formatoCantidad(linea.itbis_tasa)}
                </TableCell>
                <TableCell className="h-12 px-4 text-right text-sm font-medium tabular-nums">
                  {formatoMonedaCentavos(calculo.totalCentavos)}
                </TableCell>
              </FilaNavegable>
            );
          })}
        </TablaDocumento>
      </TarjetaDocumento>

      <SeccionesDocumento secciones={secciones} />
    </DocumentoDetalle>
  );
}
