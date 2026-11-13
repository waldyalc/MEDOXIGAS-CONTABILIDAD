import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPerfil } from "@/lib/auth/rol";
import { hoyEnRd } from "@/lib/compras/fechas";
import { formatoMoneda } from "@/lib/compras/formato";
import { rutaContacto, rutaGasto } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";
import { obtenerPagoRecurrente } from "@/lib/pagos-recurrentes/consultas";
import { siguientePeriodo } from "@/lib/pagos-recurrentes/periodos";

import { BotonGenerar } from "../_components/boton-generar";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const { id } = await params;
  const plan = await obtenerPagoRecurrente(id);
  if (!plan) notFound();

  const puedeEscribir = perfil.rol === "admin" || perfil.rol === "contador";
  const proximo = siguientePeriodo(
    { fechaInicio: plan.fecha_inicio, frecuenciaMeses: plan.frecuencia_meses, vigenciaHasta: plan.vigencia_hasta },
    hoyEnRd(),
  );

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          render={<Link href="/dashboard/pagos-recurrentes" prefetch={false} />}
        >
          <ArrowLeft data-icon="inline-start" />
          Pagos recurrentes
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{plan.nombre}</h1>
            <Badge variant={plan.activo ? "default" : "secondary"}>{plan.activo ? "Activa" : "Inactiva"}</Badge>
          </div>
          {puedeEscribir && plan.activo ? <BotonGenerar planId={plan.id} activo size="default" /> : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Plantilla</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Contacto</dt>
            <dd>
              {plan.contacto_id ? (
                <Enlace href={rutaContacto(plan.contacto_id)}>{plan.contacto_nombre ?? "—"}</Enlace>
              ) : (
                "—"
              )}
            </dd>
            <dt className="text-muted-foreground">Cuenta de gasto</dt>
            <dd>{plan.cuenta_gasto_nombre}</dd>
            <dt className="text-muted-foreground">Cuenta de pago</dt>
            <dd>{plan.cuenta_pago_nombre}</dd>
            <dt className="text-muted-foreground">Monto</dt>
            <dd className="tabular-nums">{formatoMoneda(plan.subtotal)}</dd>
            <dt className="text-muted-foreground">ITBIS</dt>
            <dd>{plan.itbis_tasa} %</dd>
            <dt className="text-muted-foreground">Frecuencia</dt>
            <dd>{plan.frecuencia_meses === 1 ? "Mensual" : `Cada ${plan.frecuencia_meses} meses`}</dd>
            <dt className="text-muted-foreground">Fecha de inicio</dt>
            <dd>{formatoDia(plan.fecha_inicio)}</dd>
            <dt className="text-muted-foreground">Vigencia hasta</dt>
            <dd>{plan.vigencia_hasta ? formatoDia(plan.vigencia_hasta) : "Sin vigencia"}</dd>
            <dt className="text-muted-foreground">Próximo periodo</dt>
            <dd className="tabular-nums">{proximo ? formatoDia(proximo) : "—"}</dd>
            <dt className="text-muted-foreground">Observaciones</dt>
            <dd className="whitespace-pre-line">{plan.notas ?? "—"}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pagos generados</CardTitle>
          <p className="text-muted-foreground text-sm">
            Cada periodo crea un gasto menor con NCF B13. No se duplica si vuelves a generar.
          </p>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-(--card-spacing)">Gasto</TableHead>
                <TableHead>NCF</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Periodo</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="pr-(--card-spacing)">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plan.gastos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground py-10 text-center">
                    Todavía no se ha generado ningún pago.
                  </TableCell>
                </TableRow>
              ) : (
                plan.gastos.map((gasto) => (
                  <TableRow key={gasto.id}>
                    <TableCell className="pl-(--card-spacing) font-medium">
                      <Enlace href={rutaGasto(gasto.id)}>#{gasto.numero}</Enlace>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{gasto.ncf ?? "—"}</TableCell>
                    <TableCell>{formatoDia(gasto.fecha)}</TableCell>
                    <TableCell>{gasto.periodo ? formatoDia(gasto.periodo) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatoMoneda(gasto.total)}</TableCell>
                    <TableCell className="pr-(--card-spacing)">
                      <Badge variant={gasto.estado === "anulado" ? "destructive" : "default"}>
                        {gasto.estado === "anulado" ? "Anulado" : "Activo"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
