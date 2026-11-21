import Link from "next/link";
import { notFound, redirect } from "next/navigation";

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
import { BookOpen } from "@/components/icons";
import { FilaNavegable } from "@/components/listas/fila-navegable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell } from "@/components/ui/table";
import { construirDepreciacion, etiquetaMes, siguientePendiente, sumarDepreciado } from "@/lib/activos-fijos/calculo";
import { getActivoDetalle } from "@/lib/activos-fijos/consultas";
import { ETIQUETAS_TIPO_ACTIVO, type TipoActivo } from "@/lib/activos-fijos/tipos";
import { getRol } from "@/lib/auth/rol";
import { rutaAsiento, rutaContacto, rutaCuenta } from "@/lib/enlaces";
import { getEmpresa } from "@/lib/facturacion/consultas";
import { formatoDia } from "@/lib/formato";
import { centavos, formatearRd } from "@/lib/reportes/dinero";

import { BotonDepreciar } from "./_components/boton-depreciar";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const [activo, empresa] = await Promise.all([getActivoDetalle(id), getEmpresa()]);
  if (!activo) notFound();

  const montoCentavos = centavos(activo.monto_total);
  const residualCentavos = centavos(activo.valor_residual);
  const depreciadoCentavos = sumarDepreciado(
    activo.depreciaciones.map((depreciacion) => ({ montoCentavos: centavos(depreciacion.monto) })),
  );
  const valorActualCentavos = montoCentavos - depreciadoCentavos;
  const totalizado = depreciadoCentavos >= montoCentavos - residualCentavos;
  const tipo = ETIQUETAS_TIPO_ACTIVO[activo.tipo_activo as TipoActivo] ?? activo.tipo_activo;

  const proyeccion = construirDepreciacion({
    montoTotalCentavos: montoCentavos,
    valorResidualCentavos: residualCentavos,
    vidaUtilMeses: activo.vida_util_meses,
    fechaInicio: activo.fecha_inicio_depreciacion,
  });
  const registradas = new Map(activo.depreciaciones.map((depreciacion) => [depreciacion.periodo, depreciacion]));
  const pendiente = siguientePendiente(
    proyeccion,
    activo.depreciaciones.map((depreciacion) => depreciacion.periodo),
  );
  const puedeEscribir = rol !== "lector";

  const estado: EstadoDetalle = totalizado
    ? { etiqueta: "Totalmente depreciado", tono: "neutral" }
    : { etiqueta: "En curso", tono: "green" };

  const informacion: CampoInformacionDocumento[] = [
    { etiqueta: "Tipo", valor: tipo },
    { etiqueta: "Referencia", valor: activo.referencia ?? "—" },
    { etiqueta: "Fecha de adquisición", valor: formatoDia(activo.fecha_adquisicion) },
    {
      etiqueta: "Proveedor",
      valor: activo.proveedor ? (
        <Enlace href={rutaContacto(activo.proveedor.id)}>{activo.proveedor.nombre}</Enlace>
      ) : (
        "—"
      ),
    },
    { etiqueta: "Inicio de depreciación", valor: formatoDia(activo.fecha_inicio_depreciacion) },
    { etiqueta: "Vida útil", valor: `${activo.vida_util_meses} meses` },
    {
      etiqueta: "Costo de adquisición",
      valor: (
        <span className="tabular-nums">
          {formatearRd(centavos(activo.costo_unitario))} × {activo.cantidad}
        </span>
      ),
    },
    {
      etiqueta: "Cuenta del activo",
      valor: activo.cuenta_activo ? (
        <Enlace href={rutaCuenta(activo.cuenta_activo.id)}>
          {activo.cuenta_activo.codigo} · {activo.cuenta_activo.nombre}
        </Enlace>
      ) : (
        "—"
      ),
    },
    {
      etiqueta: "Depreciación acumulada",
      valor: activo.cuenta_depreciacion ? (
        <Enlace href={rutaCuenta(activo.cuenta_depreciacion.id)}>
          {activo.cuenta_depreciacion.codigo} · {activo.cuenta_depreciacion.nombre}
        </Enlace>
      ) : (
        "—"
      ),
    },
    {
      etiqueta: "Cuenta de gasto",
      valor: activo.cuenta_gasto ? (
        <Enlace href={rutaCuenta(activo.cuenta_gasto.id)}>
          {activo.cuenta_gasto.codigo} · {activo.cuenta_gasto.nombre}
        </Enlace>
      ) : (
        "—"
      ),
    },
  ];

  const resumen: ItemResumenDetalle[] = [
    { etiqueta: "Monto total de inversión", valor: formatearRd(montoCentavos) },
    { etiqueta: "Depreciado", valor: formatearRd(depreciadoCentavos) },
    { etiqueta: "Valor residual", valor: formatearRd(residualCentavos) },
    { etiqueta: "Valor actual", valor: formatearRd(valorActualCentavos) },
  ];

  return (
    <DocumentoDetalle
      rutaVolver="/dashboard/contabilidad/activos"
      etiquetaVolver="Volver a activos fijos"
      titulo={activo.nombre}
      estado={estado}
      acciones={
        <>
          {activo.asiento_id ? (
            <Button
              variant="outline"
              className={CLASE_BOTON_DOCUMENTO}
              render={<Link href={rutaAsiento(activo.asiento_id)} prefetch={false} />}
            >
              <BookOpen data-icon="inline-start" />
              Ver asiento de compra
            </Button>
          ) : null}
          {puedeEscribir && pendiente ? (
            <BotonDepreciar
              activoId={activo.id}
              periodo={pendiente.periodo}
              etiqueta={etiquetaMes(pendiente.periodo)}
              montoCentavos={pendiente.montoCentavos}
            />
          ) : null}
        </>
      }
      resumen={resumen}
    >
      <TarjetaDocumento empresa={empresa} numeroDocumento={activo.referencia?.trim() || "—"}>
        <InformacionDocumento titulo="Información del activo" campos={informacion} />

        <TablaDocumento
          titulo="Tabla de depreciación"
          columnas={[
            { titulo: "Periodo" },
            { titulo: "Depreciación", alineadaDerecha: true },
            { titulo: "Estado" },
            { titulo: "Asiento", alineadaDerecha: true },
          ]}
          vacio="No hay periodos de depreciación para este activo."
          hayFilas={proyeccion.length > 0}
        >
          {proyeccion.map((periodo) => {
            const registrada = registradas.get(periodo.periodo);

            return (
              <FilaNavegable key={periodo.periodo} href={registrada ? rutaAsiento(registrada.asiento_id) : null}>
                <TableCell className="h-12 px-4 text-sm capitalize">{etiquetaMes(periodo.periodo)}</TableCell>
                <TableCell className="h-12 px-4 text-right text-sm tabular-nums">
                  {formatearRd(registrada ? centavos(registrada.monto) : periodo.montoCentavos)}
                </TableCell>
                <TableCell className="h-12 px-4 text-sm">
                  {registrada ? (
                    <Badge variant="secondary">Depreciado</Badge>
                  ) : (
                    <Badge variant="outline">Pendiente</Badge>
                  )}
                </TableCell>
                <TableCell className="h-12 px-4 text-right text-sm">
                  {registrada ? (
                    <Enlace href={rutaAsiento(registrada.asiento_id)} className="tabular-nums">
                      #{registrada.asiento_numero ?? "ver"}
                    </Enlace>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </FilaNavegable>
            );
          })}
        </TablaDocumento>
      </TarjetaDocumento>
    </DocumentoDetalle>
  );
}
