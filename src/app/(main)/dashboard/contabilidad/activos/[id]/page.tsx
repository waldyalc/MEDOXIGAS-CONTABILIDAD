import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ArrowLeft, BookOpen } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { construirDepreciacion, etiquetaMes, siguientePendiente, sumarDepreciado } from "@/lib/activos-fijos/calculo";
import { getActivoDetalle } from "@/lib/activos-fijos/consultas";
import { ETIQUETAS_TIPO_ACTIVO, type TipoActivo } from "@/lib/activos-fijos/tipos";
import { getRol } from "@/lib/auth/rol";
import { rutaAsiento, rutaContacto, rutaCuenta } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";
import { centavos, formatearRd } from "@/lib/reportes/dinero";

import { BotonDepreciar } from "./_components/boton-depreciar";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const activo = await getActivoDetalle(id);
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          render={<Link href="/dashboard/contabilidad/activos" prefetch={false} />}
        >
          <ArrowLeft data-icon="inline-start" />
          Activos fijos
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{activo.nombre}</h1>
            {totalizado ? (
              <Badge variant="secondary">Totalmente depreciado</Badge>
            ) : (
              <Badge variant="outline">En curso</Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activo.asiento_id ? (
              <Button variant="outline" render={<Link href={rutaAsiento(activo.asiento_id)} prefetch={false} />}>
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
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <dl className="grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Tipo</dt>
            <dd>{tipo}</dd>
            <dt className="text-muted-foreground">Referencia</dt>
            <dd>{activo.referencia ?? "—"}</dd>
            <dt className="text-muted-foreground">Fecha de adquisición</dt>
            <dd>{formatoDia(activo.fecha_adquisicion)}</dd>
            <dt className="text-muted-foreground">Proveedor</dt>
            <dd>
              {activo.proveedor ? (
                <Enlace href={rutaContacto(activo.proveedor.id)}>{activo.proveedor.nombre}</Enlace>
              ) : (
                "—"
              )}
            </dd>
            <dt className="text-muted-foreground">Inicio de depreciación</dt>
            <dd>{formatoDia(activo.fecha_inicio_depreciacion)}</dd>
            <dt className="text-muted-foreground">Vida útil</dt>
            <dd>{activo.vida_util_meses} meses</dd>
            <dt className="text-muted-foreground">Cuenta del activo</dt>
            <dd>
              {activo.cuenta_activo ? (
                <Enlace href={rutaCuenta(activo.cuenta_activo.id)}>
                  {activo.cuenta_activo.codigo} · {activo.cuenta_activo.nombre}
                </Enlace>
              ) : (
                "—"
              )}
            </dd>
            <dt className="text-muted-foreground">Depreciación acumulada</dt>
            <dd>
              {activo.cuenta_depreciacion ? (
                <Enlace href={rutaCuenta(activo.cuenta_depreciacion.id)}>
                  {activo.cuenta_depreciacion.codigo} · {activo.cuenta_depreciacion.nombre}
                </Enlace>
              ) : (
                "—"
              )}
            </dd>
            <dt className="text-muted-foreground">Cuenta de gasto</dt>
            <dd>
              {activo.cuenta_gasto ? (
                <Enlace href={rutaCuenta(activo.cuenta_gasto.id)}>
                  {activo.cuenta_gasto.codigo} · {activo.cuenta_gasto.nombre}
                </Enlace>
              ) : (
                "—"
              )}
            </dd>
          </dl>

          <div className="flex flex-col gap-2 rounded-lg border p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Costo de adquisición</span>
              <span className="tabular-nums">
                {formatearRd(centavos(activo.costo_unitario))} × {activo.cantidad}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Monto total de inversión</span>
              <span className="tabular-nums">{formatearRd(montoCentavos)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Valor residual</span>
              <span className="tabular-nums">{formatearRd(residualCentavos)}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-2 text-sm">
              <span className="text-muted-foreground">Depreciado</span>
              <span className="tabular-nums">{formatearRd(depreciadoCentavos)}</span>
            </div>
            <div className="flex items-center justify-between text-base font-semibold">
              <span>Valor actual</span>
              <span className="tabular-nums">{formatearRd(valorActualCentavos)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tabla de depreciación</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {proyeccion.length === 0 ? (
            <p className="text-muted-foreground px-6 py-8 text-center text-sm">
              No hay periodos de depreciación para este activo.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-(--card-spacing)">Periodo</TableHead>
                  <TableHead className="text-right">Depreciación</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="pr-(--card-spacing) text-right">Asiento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proyeccion.map((periodo) => {
                  const registrada = registradas.get(periodo.periodo);

                  return (
                    <TableRow key={periodo.periodo}>
                      <TableCell className="pl-(--card-spacing) capitalize">{etiquetaMes(periodo.periodo)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatearRd(registrada ? centavos(registrada.monto) : periodo.montoCentavos)}
                      </TableCell>
                      <TableCell>
                        {registrada ? (
                          <Badge variant="secondary">Depreciado</Badge>
                        ) : (
                          <Badge variant="outline">Pendiente</Badge>
                        )}
                      </TableCell>
                      <TableCell className="pr-(--card-spacing) text-right">
                        {registrada ? (
                          <Link className="hover:underline" href={rutaAsiento(registrada.asiento_id)} prefetch={false}>
                            #{registrada.asiento_numero ?? "ver"}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
