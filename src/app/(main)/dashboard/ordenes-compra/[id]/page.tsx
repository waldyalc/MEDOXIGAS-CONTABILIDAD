import Link from "next/link";
import { notFound, redirect } from "next/navigation";

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
import { ReceiptText, ShoppingBag } from "@/components/icons";
import { FilaNavegable } from "@/components/listas/fila-navegable";
import { Button } from "@/components/ui/button";
import { TableCell } from "@/components/ui/table";
import { getPerfil } from "@/lib/auth/rol";
import { aNumero } from "@/lib/compras/calculo";
import { formatoCantidad, formatoMoneda } from "@/lib/compras/formato";
import { rutaCompra, rutaContacto, rutaCuenta, rutaProducto } from "@/lib/enlaces";
import { getEmpresa } from "@/lib/facturacion/consultas";
import { formatoDia } from "@/lib/formato";
import { obtenerOrdenCompra } from "@/lib/ordenes-compra/consultas";
import type { EstadoOrdenCompra } from "@/lib/ordenes-compra/tipos";

const ESTADOS_ORDEN: Record<EstadoOrdenCompra, EstadoDetalle> = {
  abierta: { etiqueta: "Abierta", tono: "amber" },
  convertida: { etiqueta: "Convertida", tono: "green" },
  anulada: { etiqueta: "Anulada", tono: "red" },
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const { id } = await params;
  const [orden, empresa] = await Promise.all([obtenerOrdenCompra(id), getEmpresa()]);
  if (!orden) notFound();

  const puedeEscribir = perfil.rol === "admin" || perfil.rol === "contador";

  const informacion: CampoInformacionDocumento[] = [
    {
      etiqueta: "Proveedor",
      valor: <Enlace href={rutaContacto(orden.contacto_id)}>{orden.contacto_nombre}</Enlace>,
    },
    { etiqueta: "Fecha", valor: formatoDia(orden.fecha) },
    { etiqueta: "Entrega", valor: formatoDia(orden.fecha_entrega) },
    {
      etiqueta: "Notas",
      valor: orden.notas ? <span className="whitespace-pre-line">{orden.notas}</span> : "—",
    },
    {
      etiqueta: "Términos",
      valor: orden.terminos ? <span className="whitespace-pre-line">{orden.terminos}</span> : "—",
    },
  ];

  return (
    <DocumentoDetalle
      rutaVolver="/dashboard/ordenes-compra"
      etiquetaVolver="Volver a órdenes de compra"
      titulo={`Orden de compra #${orden.numero}`}
      estado={ESTADOS_ORDEN[orden.estado]}
      acciones={
        <>
          {orden.factura_proveedor_id ? (
            <Button
              variant="outline"
              className={CLASE_BOTON_DOCUMENTO}
              render={<Link href={rutaCompra(orden.factura_proveedor_id)} prefetch={false} />}
            >
              <ReceiptText data-icon="inline-start" />
              Ver factura de proveedor
            </Button>
          ) : null}
          {puedeEscribir && orden.estado === "abierta" ? (
            <Button render={<Link href={`/dashboard/compras/nueva?orden=${orden.id}`} prefetch={false} />}>
              <ShoppingBag data-icon="inline-start" />
              Convertir en factura de proveedor
            </Button>
          ) : null}
        </>
      }
    >
      <TarjetaDocumento empresa={empresa} numeroDocumento={String(orden.numero)}>
        <InformacionDocumento titulo="Información de la orden" campos={informacion} />

        <p className="text-muted-foreground mt-8 text-sm">
          Esta orden es un documento de control: no mueve inventario ni genera asiento contable.
        </p>

        <TablaDocumento
          titulo="Líneas de la orden"
          columnas={[
            { titulo: "Descripción" },
            { titulo: "Cantidad", alineadaDerecha: true },
            { titulo: "Costo", alineadaDerecha: true },
            { titulo: "ITBIS %", alineadaDerecha: true },
            { titulo: "Subtotal", alineadaDerecha: true },
            { titulo: "ITBIS", alineadaDerecha: true },
            { titulo: "Total", alineadaDerecha: true },
          ]}
          vacio="La orden no tiene líneas."
          hayFilas={orden.lineas.length > 0}
        >
          {orden.lineas.map((linea) => (
            <FilaNavegable key={linea.id} href={linea.producto_id ? rutaProducto(linea.producto_id) : null}>
              <TableCell className="h-12 px-4 text-sm whitespace-normal">
                <div className="flex flex-col">
                  <span>{linea.descripcion || "—"}</span>
                  {linea.productos ? (
                    <span className="text-muted-foreground text-xs">
                      {linea.producto_id ? (
                        <Enlace href={rutaProducto(linea.producto_id)}>{linea.productos.nombre}</Enlace>
                      ) : (
                        linea.productos.nombre
                      )}
                    </span>
                  ) : null}
                  {linea.cuentas ? (
                    <span className="text-muted-foreground text-xs">
                      {linea.cuenta_id ? (
                        <Enlace href={rutaCuenta(linea.cuenta_id)}>
                          {linea.cuentas.codigo} — {linea.cuentas.nombre}
                        </Enlace>
                      ) : (
                        `${linea.cuentas.codigo} — ${linea.cuentas.nombre}`
                      )}
                    </span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="h-12 px-4 text-right text-sm tabular-nums">
                {formatoCantidad(linea.cantidad)}
              </TableCell>
              <TableCell className="h-12 px-4 text-right text-sm tabular-nums">{formatoMoneda(linea.costo)}</TableCell>
              <TableCell className="h-12 px-4 text-right text-sm tabular-nums">
                {formatoCantidad(linea.itbis_tasa)}
              </TableCell>
              <TableCell className="h-12 px-4 text-right text-sm tabular-nums">
                {formatoMoneda(linea.subtotal)}
              </TableCell>
              <TableCell className="h-12 px-4 text-right text-sm tabular-nums">{formatoMoneda(linea.itbis)}</TableCell>
              <TableCell className="h-12 px-4 text-right text-sm tabular-nums">{formatoMoneda(linea.total)}</TableCell>
            </FilaNavegable>
          ))}
        </TablaDocumento>

        <TotalesDocumento
          filas={[
            { etiqueta: "Subtotal", valor: formatoMoneda(aNumero(orden.subtotal)) },
            { etiqueta: "ITBIS", valor: formatoMoneda(aNumero(orden.itbis)) },
          ]}
          total={formatoMoneda(aNumero(orden.total))}
        />
      </TarjetaDocumento>
    </DocumentoDetalle>
  );
}
