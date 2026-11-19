import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { BookOpen } from "lucide-react";

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
import { ComprobanteEgreso } from "@/components/impresion/comprobante-egreso";
import { FilaNavegable } from "@/components/listas/fila-navegable";
import { Button } from "@/components/ui/button";
import { TableCell } from "@/components/ui/table";
import { getRol } from "@/lib/auth/rol";
import { obtenerPagoProveedor } from "@/lib/compras/detalle";
import type { MetodoPago } from "@/lib/compras/tipos";
import { rutaAsiento, rutaCompra, rutaContacto, rutaCuenta } from "@/lib/enlaces";
import { getEmpresa } from "@/lib/facturacion/consultas";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";
import { puedeAnularDocumento } from "@/lib/pagos/anulacion";

import { AccionesPagoProveedor } from "./_components/acciones-pago-proveedor";

const ETIQUETAS_METODO: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  cheque: "Cheque",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [rol, pago, empresa] = await Promise.all([getRol(), obtenerPagoProveedor(id), getEmpresa()]);
  if (rol == null) redirect("/unauthorized");
  if (!pago) notFound();

  const puedeAnular = puedeAnularDocumento(rol, pago.estado);
  const estado: EstadoDetalle =
    pago.estado === "anulado" ? { etiqueta: "Anulado", tono: "red" } : { etiqueta: "Activo", tono: "green" };

  const informacion: CampoInformacionDocumento[] = [
    {
      etiqueta: "Proveedor",
      valor: <Enlace href={rutaContacto(pago.contacto_id)}>{pago.contacto?.nombre ?? "—"}</Enlace>,
    },
    { etiqueta: "RNC", valor: pago.contacto?.rnc_cedula ?? "—" },
    { etiqueta: "Fecha", valor: formatoDia(pago.fecha) },
    { etiqueta: "Método", valor: ETIQUETAS_METODO[pago.metodo] },
    {
      etiqueta: "Cuenta",
      valor: pago.cuenta ? (
        <Enlace href={rutaCuenta(pago.cuenta_id)}>{`${pago.cuenta.codigo} · ${pago.cuenta.nombre}`}</Enlace>
      ) : (
        "—"
      ),
    },
    {
      etiqueta: "Notas",
      valor: pago.notas ? <span className="whitespace-pre-line">{pago.notas}</span> : "—",
    },
  ];

  return (
    <DocumentoDetalle
      rutaVolver="/dashboard/compras/pagos"
      etiquetaVolver="Volver a pagos a proveedores"
      titulo={`Pago a proveedor #${pago.numero}`}
      estado={estado}
      acciones={
        <>
          <ComprobanteEgreso pago={pago} empresa={empresa} classNameBoton={CLASE_BOTON_DOCUMENTO} />
          {pago.asiento_id ? (
            <Button
              variant="outline"
              className={CLASE_BOTON_DOCUMENTO}
              render={<Link href={rutaAsiento(pago.asiento_id)} prefetch={false} />}
            >
              <BookOpen data-icon="inline-start" />
              Ver asiento
            </Button>
          ) : null}
          {puedeAnular ? <AccionesPagoProveedor pagoId={pago.id} numero={pago.numero} /> : null}
        </>
      }
    >
      <TarjetaDocumento empresa={empresa} numeroDocumento={String(pago.numero)}>
        <InformacionDocumento titulo="Información del pago" campos={informacion} />

        <TablaDocumento
          titulo="Facturas aplicadas"
          columnas={[
            { titulo: "Número" },
            { titulo: "NCF" },
            { titulo: "Monto", alineadaDerecha: true },
            { titulo: "Retención", alineadaDerecha: true },
          ]}
          vacio="Este pago no tiene facturas aplicadas."
          hayFilas={pago.aplicaciones.length > 0}
        >
          {pago.aplicaciones.map((aplicacion) => (
            <FilaNavegable key={aplicacion.factura_proveedor_id} href={rutaCompra(aplicacion.factura_proveedor_id)}>
              <TableCell className="h-12 px-4 text-sm font-medium">
                <Enlace href={rutaCompra(aplicacion.factura_proveedor_id)}>#{aplicacion.numero}</Enlace>
              </TableCell>
              <TableCell className="h-12 px-4 font-mono text-xs">{aplicacion.ncf ?? "—"}</TableCell>
              <TableCell className="h-12 px-4 text-right text-sm tabular-nums">
                {formatoMoneda(aplicacion.monto)}
              </TableCell>
              <TableCell className="h-12 px-4 text-right text-sm tabular-nums">
                {formatoMoneda(aplicacion.retenido)}
              </TableCell>
            </FilaNavegable>
          ))}
        </TablaDocumento>

        <TotalesDocumento
          filas={[
            { etiqueta: "Monto", valor: formatoMoneda(pago.monto) },
            { etiqueta: "Retención", valor: formatoMoneda(pago.retenido) },
          ]}
          total={formatoMoneda(pago.monto + pago.retenido)}
          etiquetaTotal="Total aplicado"
        />
      </TarjetaDocumento>
    </DocumentoDetalle>
  );
}
