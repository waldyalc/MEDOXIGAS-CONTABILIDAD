import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  type CampoInformacionDocumento,
  CLASE_BOTON_DOCUMENTO,
  DocumentoDetalle,
  type EstadoDetalle,
  InformacionDocumento,
  TarjetaDocumento,
  TotalesDocumento,
} from "@/components/documento/documento-detalle";
import { Enlace } from "@/components/enlace";
import { BookOpen } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { getRol } from "@/lib/auth/rol";
import { rutaAsiento, rutaContacto, rutaCuenta } from "@/lib/enlaces";
import { getEmpresa } from "@/lib/facturacion/consultas";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";
import { obtenerGasto } from "@/lib/gastos/detalle";
import { puedeAnularDocumento } from "@/lib/pagos/anulacion";

import { AccionesGasto } from "./_components/acciones-gasto";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [rol, gasto, empresa] = await Promise.all([getRol(), obtenerGasto(id), getEmpresa()]);
  if (rol == null) redirect("/unauthorized");
  if (!gasto) notFound();

  const puedeAnular = puedeAnularDocumento(rol, gasto.estado);
  const estado: EstadoDetalle =
    gasto.estado === "anulado" ? { etiqueta: "Anulado", tono: "red" } : { etiqueta: "Activo", tono: "green" };

  const informacion: CampoInformacionDocumento[] = [
    { etiqueta: "NCF", valor: gasto.ncf ?? "—" },
    { etiqueta: "Fecha", valor: formatoDia(gasto.fecha) },
    {
      etiqueta: "Descripción",
      valor: <span className="whitespace-pre-line">{gasto.descripcion}</span>,
    },
    {
      etiqueta: "Proveedor",
      valor: gasto.contacto_id ? (
        <Enlace href={rutaContacto(gasto.contacto_id)}>{gasto.contacto?.nombre ?? "—"}</Enlace>
      ) : (
        "—"
      ),
    },
    {
      etiqueta: "Cuenta de gasto",
      valor: (
        <Enlace href={rutaCuenta(gasto.cuenta_gasto_id)}>
          {gasto.cuenta_gasto ? `${gasto.cuenta_gasto.codigo} · ${gasto.cuenta_gasto.nombre}` : "—"}
        </Enlace>
      ),
    },
    {
      etiqueta: "Cuenta de pago",
      valor: (
        <Enlace href={rutaCuenta(gasto.cuenta_pago_id)}>
          {gasto.cuenta_pago ? `${gasto.cuenta_pago.codigo} · ${gasto.cuenta_pago.nombre}` : "—"}
        </Enlace>
      ),
    },
  ];

  return (
    <DocumentoDetalle
      rutaVolver="/dashboard/gastos"
      etiquetaVolver="Volver a gastos menores"
      titulo={`Gasto menor #${gasto.numero}`}
      estado={estado}
      acciones={
        <>
          {gasto.asiento_id ? (
            <Button
              variant="outline"
              className={CLASE_BOTON_DOCUMENTO}
              render={<Link href={rutaAsiento(gasto.asiento_id)} prefetch={false} />}
            >
              <BookOpen data-icon="inline-start" />
              Ver asiento
            </Button>
          ) : null}
          {puedeAnular ? <AccionesGasto gastoId={gasto.id} numero={gasto.numero} /> : null}
        </>
      }
    >
      <TarjetaDocumento empresa={empresa} numeroDocumento={String(gasto.numero)}>
        <InformacionDocumento titulo="Información del gasto" campos={informacion} />

        <TotalesDocumento
          filas={[
            { etiqueta: "Subtotal", valor: formatoMoneda(gasto.subtotal) },
            { etiqueta: "ITBIS", valor: formatoMoneda(gasto.itbis) },
          ]}
          total={formatoMoneda(gasto.total)}
        />
      </TarjetaDocumento>
    </DocumentoDetalle>
  );
}
