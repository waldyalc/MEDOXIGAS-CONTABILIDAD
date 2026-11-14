import Link from "next/link";
import { redirect } from "next/navigation";

import { Plus } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRol } from "@/lib/auth/rol";
import { hoyEnRd } from "@/lib/compras/fechas";
import { formatoMoneda } from "@/lib/compras/formato";
import { rutaContacto, rutaCuenta, rutaPagoRecurrente } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";
import { listarPagosRecurrentes } from "@/lib/pagos-recurrentes/consultas";
import { siguientePeriodo } from "@/lib/pagos-recurrentes/periodos";
import type { PagoRecurrenteLista } from "@/lib/pagos-recurrentes/tipos";

import { BotonGenerar } from "./_components/boton-generar";

function FilaPlan({ plan, hoy, puedeEscribir }: { plan: PagoRecurrenteLista; hoy: string; puedeEscribir: boolean }) {
  const proximo = siguientePeriodo(
    {
      fechaInicio: plan.fecha_inicio,
      frecuenciaMeses: plan.frecuencia_meses,
      vigenciaHasta: plan.vigencia_hasta,
    },
    hoy,
  );

  return (
    <TableRow>
      <TableCell className="pl-(--card-spacing) font-medium">
        <Enlace href={rutaPagoRecurrente(plan.id)}>{plan.nombre}</Enlace>
      </TableCell>
      <TableCell>
        {plan.contacto_id ? (
          <Enlace href={rutaContacto(plan.contacto_id)}>{plan.contacto_nombre ?? "—"}</Enlace>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <Enlace href={rutaCuenta(plan.cuenta_gasto_id)}>{plan.cuenta_gasto_nombre}</Enlace>
      </TableCell>
      <TableCell>
        <Enlace href={rutaCuenta(plan.cuenta_pago_id)}>{plan.cuenta_pago_nombre}</Enlace>
      </TableCell>
      <TableCell>{plan.frecuencia_meses === 1 ? "Mensual" : `Cada ${plan.frecuencia_meses} meses`}</TableCell>
      <TableCell className="tabular-nums">{proximo ? formatoDia(proximo) : "—"}</TableCell>
      <TableCell className="text-right tabular-nums">{formatoMoneda(plan.subtotal)}</TableCell>
      <TableCell>
        <Badge variant={plan.activo ? "default" : "secondary"}>{plan.activo ? "Activa" : "Inactiva"}</Badge>
      </TableCell>
      {puedeEscribir ? (
        <TableCell className="pr-(--card-spacing) text-right">
          <BotonGenerar planId={plan.id} activo={plan.activo} />
        </TableCell>
      ) : null}
    </TableRow>
  );
}

export default async function Page() {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const [planes, hoy] = [await listarPagosRecurrentes(), hoyEnRd()];
  const puedeEscribir = rol !== "lector";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Pagos recurrentes</h1>
          <p className="text-muted-foreground text-sm">
            Plantillas de gastos fijos (alquiler, luz, internet). Genera el gasto menor de cada periodo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/dashboard/compras" prefetch={false} />}>
            Compras
          </Button>
          {puedeEscribir ? (
            <Button render={<Link href="/dashboard/pagos-recurrentes/nueva" prefetch={false} />}>
              <Plus data-icon="inline-start" />
              Nueva plantilla
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-(--card-spacing)">Nombre</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Cuenta de gasto</TableHead>
                <TableHead>Cuenta de pago</TableHead>
                <TableHead>Frecuencia</TableHead>
                <TableHead>Próximo periodo</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Estado</TableHead>
                {puedeEscribir ? <TableHead className="pr-(--card-spacing) text-right">Acción</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {planes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={puedeEscribir ? 9 : 8} className="text-muted-foreground py-10 text-center">
                    No hay pagos recurrentes registrados.
                  </TableCell>
                </TableRow>
              ) : (
                planes.map((plan) => <FilaPlan key={plan.id} plan={plan} hoy={hoy} puedeEscribir={puedeEscribir} />)
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
