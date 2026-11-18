import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { BookOpen, ReceiptText } from "lucide-react";

import {
  type CampoInformacionDocumento,
  CLASE_BOTON_DOCUMENTO,
  DocumentoDetalle,
  type EstadoDetalle,
  InformacionDocumento,
  TablaDocumento,
  TarjetaDocumento,
  TotalesDocumento,
} from "@/components/documento/documento-detalle";
import { Enlace } from "@/components/enlace";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { getPerfil } from "@/lib/auth/rol";
import { rutaAsiento, rutaContacto, rutaFactura, rutaProducto } from "@/lib/enlaces";
import { getEmpresa } from "@/lib/facturacion/consultas";
import { formatoCantidad, formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";
import { getNotaCreditoVista } from "@/lib/notas-credito/consultas";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const { id } = await params;
  const [nota, empresa] = await Promise.all([getNotaCreditoVista(id), getEmpresa()]);
  if (!nota) notFound();

  const estado: EstadoDetalle =
    nota.estado === "anulada" ? { etiqueta: "Anulada", tono: "red" } : { etiqueta: "Activa", tono: "green" };

  const informacion: CampoInformacionDocumento[] = [
    {
      etiqueta: "Cliente",
      valor: <Enlace href={rutaContacto(nota.contacto_id)}>{nota.cliente_nombre}</Enlace>,
    },
    {
      etiqueta: "Factura",
      valor: (
        <Enlace href={rutaFactura(nota.factura_id)}>
          {`#${nota.factura_numero}`}
          {nota.factura_ncf ? ` · ${nota.factura_ncf}` : ""}
        </Enlace>
      ),
    },
    { etiqueta: "Comprobante", valor: "Nota de crédito (B04)" },
    { etiqueta: "Fecha", valor: formatoDia(nota.fecha) },
    { etiqueta: "Devuelve inventario", valor: nota.devuelve_inventario ? "Sí" : "No" },
    {
      etiqueta: "Notas",
      valor: nota.notas ? <span className="whitespace-pre-line">{nota.notas}</span> : "—",
    },
  ];

  return (
    <DocumentoDetalle
      rutaVolver="/dashboard/notas-credito"
      etiquetaVolver="Volver a notas de crédito"
      titulo={`Nota de crédito #${nota.numero}`}
      estado={estado}
      acciones={
        <>
          {/* TODO backend: Alegra imprime la nota de crédito; el repo todavía
              no tiene papel de impresión de notas. */}
          {nota.asiento_id ? (
            <Button
              variant="outline"
              className={CLASE_BOTON_DOCUMENTO}
              render={<Link href={rutaAsiento(nota.asiento_id)} prefetch={false} />}
            >
              <BookOpen data-icon="inline-start" />
              Ver asiento
            </Button>
          ) : null}
          <Button
            variant="outline"
            className={CLASE_BOTON_DOCUMENTO}
            render={<Link href={rutaFactura(nota.factura_id)} prefetch={false} />}
          >
            <ReceiptText data-icon="inline-start" />
            Ver factura
          </Button>
        </>
      }
    >
      <TarjetaDocumento empresa={empresa} numeroDocumento={nota.ncf}>
        <InformacionDocumento titulo="Información de la nota" campos={informacion} columnas={2} />

        <TablaDocumento
          titulo="Líneas de la nota"
          columnas={[
            { titulo: "Descripción" },
            { titulo: "Cantidad", alineadaDerecha: true },
            { titulo: "Precio", alineadaDerecha: true },
            { titulo: "Desc. %", alineadaDerecha: true },
            { titulo: "ITBIS %", alineadaDerecha: true },
            { titulo: "Subtotal", alineadaDerecha: true },
            { titulo: "ITBIS", alineadaDerecha: true },
            { titulo: "Total", alineadaDerecha: true },
          ]}
          vacio="La nota no tiene líneas."
          hayFilas={nota.lineas.length > 0}
        >
          {nota.lineas.map((linea) => (
            <TableRow key={linea.id}>
              <TableCell className="h-12 px-4 text-sm font-medium whitespace-normal">
                <div className="flex flex-col">
                  <span>{linea.descripcion}</span>
                  {linea.productos ? (
                    <span className="text-muted-foreground text-xs">
                      {linea.producto_id ? (
                        <Enlace href={rutaProducto(linea.producto_id)}>{linea.productos.nombre}</Enlace>
                      ) : (
                        linea.productos.nombre
                      )}
                    </span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="h-12 px-4 text-right text-sm tabular-nums">
                {formatoCantidad(linea.cantidad)}
              </TableCell>
              <TableCell className="h-12 px-4 text-right text-sm tabular-nums">{formatoMoneda(linea.precio)}</TableCell>
              <TableCell className="h-12 px-4 text-right text-sm tabular-nums">
                {formatoCantidad(linea.descuento_pct)}
              </TableCell>
              <TableCell className="h-12 px-4 text-right text-sm tabular-nums">
                {formatoCantidad(linea.itbis_tasa)}
              </TableCell>
              <TableCell className="h-12 px-4 text-right text-sm tabular-nums">
                {formatoMoneda(linea.subtotal)}
              </TableCell>
              <TableCell className="h-12 px-4 text-right text-sm tabular-nums">{formatoMoneda(linea.itbis)}</TableCell>
              <TableCell className="h-12 px-4 text-right text-sm font-medium tabular-nums">
                {formatoMoneda(linea.total)}
              </TableCell>
            </TableRow>
          ))}
        </TablaDocumento>

        <TotalesDocumento
          filas={[
            { etiqueta: "Subtotal", valor: formatoMoneda(nota.subtotal) },
            { etiqueta: "ITBIS", valor: formatoMoneda(nota.itbis) },
          ]}
          total={formatoMoneda(nota.total)}
        />
      </TarjetaDocumento>
    </DocumentoDetalle>
  );
}
