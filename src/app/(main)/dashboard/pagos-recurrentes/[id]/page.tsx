import { notFound, redirect } from "next/navigation";

import {
  type CampoInformacionDocumento,
  DocumentoDetalle,
  type EstadoDetalle,
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
import { hoyEnRd } from "@/lib/compras/fechas";
import { formatoMoneda } from "@/lib/compras/formato";
import { rutaAsiento, rutaContacto, rutaCuenta, rutaGasto } from "@/lib/enlaces";
import { getEmpresa } from "@/lib/facturacion/consultas";
import { formatoDia } from "@/lib/formato";
import { obtenerPagoRecurrente } from "@/lib/pagos-recurrentes/consultas";
import { siguientePeriodo } from "@/lib/pagos-recurrentes/periodos";

import { BotonGenerar } from "../_components/boton-generar";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const { id } = await params;
  const [plan, empresa] = await Promise.all([obtenerPagoRecurrente(id), getEmpresa()]);
  if (!plan) notFound();

  const puedeEscribir = perfil.rol === "admin" || perfil.rol === "contador";
  const proximo = siguientePeriodo(
    { fechaInicio: plan.fecha_inicio, frecuenciaMeses: plan.frecuencia_meses, vigenciaHasta: plan.vigencia_hasta },
    hoyEnRd(),
  );

  const estado: EstadoDetalle = plan.activo
    ? { etiqueta: "Activa", tono: "green" }
    : { etiqueta: "Inactiva", tono: "neutral" };

  const informacion: CampoInformacionDocumento[] = [
    {
      etiqueta: "Contacto",
      valor: plan.contacto_id ? (
        <Enlace href={rutaContacto(plan.contacto_id)}>{plan.contacto_nombre ?? "—"}</Enlace>
      ) : (
        "—"
      ),
    },
    {
      etiqueta: "Cuenta de gasto",
      valor: <Enlace href={rutaCuenta(plan.cuenta_gasto_id)}>{plan.cuenta_gasto_nombre}</Enlace>,
    },
    {
      etiqueta: "Cuenta de pago",
      valor: <Enlace href={rutaCuenta(plan.cuenta_pago_id)}>{plan.cuenta_pago_nombre}</Enlace>,
    },
    { etiqueta: "Monto", valor: <span className="tabular-nums">{formatoMoneda(plan.subtotal)}</span> },
    { etiqueta: "ITBIS", valor: `${plan.itbis_tasa} %` },
    {
      etiqueta: "Frecuencia",
      valor: plan.frecuencia_meses === 1 ? "Mensual" : `Cada ${plan.frecuencia_meses} meses`,
    },
    { etiqueta: "Fecha de inicio", valor: formatoDia(plan.fecha_inicio) },
    { etiqueta: "Vigencia hasta", valor: plan.vigencia_hasta ? formatoDia(plan.vigencia_hasta) : "Sin vigencia" },
    {
      etiqueta: "Próximo periodo",
      valor: <span className="tabular-nums">{proximo ? formatoDia(proximo) : "—"}</span>,
    },
    {
      etiqueta: "Observaciones",
      valor: plan.notas ? <span className="whitespace-pre-line">{plan.notas}</span> : "—",
    },
  ];

  const secciones: SeccionDocumento[] = [
    {
      valor: "pagos",
      etiqueta: "Pagos generados",
      contenido: (
        <div className="flex flex-col gap-4">
          <p className="text-muted-foreground text-sm">
            Cada periodo crea un gasto menor con NCF B13. No se duplica si vuelves a generar.
          </p>

          <TablaDocumento
            columnas={[
              { titulo: "Gasto" },
              { titulo: "NCF" },
              { titulo: "Fecha" },
              { titulo: "Periodo" },
              { titulo: "Asiento" },
              { titulo: "Total", alineadaDerecha: true },
              { titulo: "Estado" },
            ]}
            vacio="Todavía no se ha generado ningún pago."
            hayFilas={plan.gastos.length > 0}
          >
            {plan.gastos.map((gasto) => (
              <FilaNavegable key={gasto.id} href={rutaGasto(gasto.id)}>
                <TableCell className="h-12 px-4 text-sm font-medium">
                  <Enlace href={rutaGasto(gasto.id)}>#{gasto.numero}</Enlace>
                </TableCell>
                <TableCell className="h-12 px-4 font-mono text-xs">{gasto.ncf ?? "—"}</TableCell>
                <TableCell className="h-12 px-4 text-sm">{formatoDia(gasto.fecha)}</TableCell>
                <TableCell className="h-12 px-4 text-sm">{gasto.periodo ? formatoDia(gasto.periodo) : "—"}</TableCell>
                <TableCell className="h-12 px-4 text-sm tabular-nums">
                  {gasto.asiento_id ? <Enlace href={rutaAsiento(gasto.asiento_id)}>Ver asiento</Enlace> : "—"}
                </TableCell>
                <TableCell className="h-12 px-4 text-right text-sm tabular-nums">
                  {formatoMoneda(gasto.total)}
                </TableCell>
                <TableCell className="h-12 px-4 text-sm">
                  <Badge variant={gasto.estado === "anulado" ? "destructive" : "default"}>
                    {gasto.estado === "anulado" ? "Anulado" : "Activo"}
                  </Badge>
                </TableCell>
              </FilaNavegable>
            ))}
          </TablaDocumento>
        </div>
      ),
    },
  ];

  return (
    <DocumentoDetalle
      rutaVolver="/dashboard/pagos-recurrentes"
      etiquetaVolver="Volver a pagos recurrentes"
      titulo={plan.nombre}
      estado={estado}
      acciones={puedeEscribir && plan.activo ? <BotonGenerar planId={plan.id} activo size="default" /> : null}
    >
      <TarjetaDocumento empresa={empresa} numeroDocumento={plan.nombre}>
        <InformacionDocumento titulo="Información de la plantilla" campos={informacion} />
      </TarjetaDocumento>

      <SeccionesDocumento secciones={secciones} />
    </DocumentoDetalle>
  );
}
