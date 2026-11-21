import { cn } from "cn";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoFechaHora } from "@/lib/formato";
import { compararMontos, sumarMontos } from "@/lib/pos/calculo";
import type { ResumenTurnoVista } from "@/lib/pos/tipos";

function Kpi({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <Card className="py-3">
      <CardContent className="flex flex-col gap-0.5 px-3">
        <span className="text-muted-foreground text-xs">{titulo}</span>
        <span className="text-lg font-semibold tabular-nums">{valor}</span>
        {detalle ? <span className="text-muted-foreground text-xs">{detalle}</span> : null}
      </CardContent>
    </Card>
  );
}

function Fila({
  etiqueta,
  valor,
  tenue,
  negativo,
}: {
  etiqueta: string;
  valor: string;
  tenue?: boolean;
  negativo?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5 text-sm">
      <span className={cn(tenue ? "text-muted-foreground" : "")}>{etiqueta}</span>
      <span className={cn("tabular-nums", negativo ? "text-destructive" : "", tenue ? "text-muted-foreground" : "")}>
        {valor}
      </span>
    </div>
  );
}

export function ResumenTurno({ vista, compacto = false }: { vista: ResumenTurnoVista; compacto?: boolean }) {
  const { turno, resumen } = vista;
  const otros = sumarMontos([resumen.ventas.por_metodo.tarjeta, resumen.ventas.por_metodo.transferencia]);
  const esperadoNegativo = compararMontos(resumen.efectivo.efectivo_esperado, "0") < 0;
  const cerrado = turno.estado === "cerrado" || resumen.efectivo.congelado;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">{`Turno No ${turno.numero}`}</h2>
        <Badge variant={cerrado ? "destructive" : "secondary"}>{cerrado ? "Cerrado" : "Abierto"}</Badge>
        <span className="text-muted-foreground text-xs">
          {turno.cerrado_en
            ? `Cerrado ${formatoFechaHora(turno.cerrado_en)}`
            : `Abierto desde ${formatoFechaHora(turno.abierto_en)}`}
        </span>
        <span className="text-muted-foreground text-xs">
          {turno.cerrado_en
            ? `Abierto por ${turno.abierto_por_nombre ?? "—"} · Cerrado por ${turno.cerrado_por_nombre ?? "—"}`
            : `Abierto por ${turno.abierto_por_nombre ?? "—"}`}
        </span>
      </div>

      {cerrado ? (
        <p className="text-muted-foreground text-xs">El efectivo esperado quedó congelado al cerrar.</p>
      ) : null}

      {esperadoNegativo ? (
        <Alert variant="destructive">
          <AlertDescription>
            El efectivo esperado es negativo; revisa los pagos y devoluciones del turno antes de cerrar.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Kpi
          titulo="Ventas"
          valor={formatoMoneda(resumen.ventas.total)}
          detalle={resumen.ventas.cantidad === 1 ? "1 venta" : `${resumen.ventas.cantidad} ventas`}
        />
        <Kpi titulo="Ventas en efectivo" valor={formatoMoneda(resumen.ventas.por_metodo.efectivo)} />
        <Kpi
          titulo="Otros métodos"
          valor={formatoMoneda(otros)}
          detalle={`Transferencia ${formatoMoneda(resumen.ventas.por_metodo.transferencia)}`}
        />
        <Kpi titulo="Efectivo esperado" valor={formatoMoneda(resumen.efectivo.efectivo_esperado)} />
      </div>

      {compacto ? null : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="border-border bg-card rounded-xl border p-3">
            <p className="mb-1 text-sm font-medium">Detalle</p>
            <Fila etiqueta="Base inicial" valor={formatoMoneda(resumen.efectivo.base_inicial)} />
            <Fila etiqueta="Ventas en efectivo" valor={formatoMoneda(resumen.ventas.por_metodo.efectivo)} />
            <Fila
              etiqueta="Ventas con tarjeta"
              valor={formatoMoneda(resumen.ventas.por_metodo.tarjeta)}
              tenue={compararMontos(resumen.ventas.por_metodo.tarjeta, "0") === 0}
            />
            <Fila
              etiqueta="Ventas por transferencia"
              valor={formatoMoneda(resumen.ventas.por_metodo.transferencia)}
              tenue={compararMontos(resumen.ventas.por_metodo.transferencia, "0") === 0}
            />
            <Fila
              etiqueta="Ventas a crédito"
              valor={formatoMoneda(resumen.ventas.por_metodo.credito)}
              tenue={compararMontos(resumen.ventas.por_metodo.credito, "0") === 0}
            />
          </div>

          <div className="border-border bg-card rounded-xl border p-3">
            <p className="mb-1 text-sm font-medium">Ingresos y retiros</p>
            <Fila etiqueta="Ingresos" valor={formatoMoneda(resumen.ingresos.total)} />
            <Fila etiqueta="Fondo de caja" valor={formatoMoneda(resumen.ingresos.por_motivo.fondo_caja)} tenue />
            <Fila etiqueta="Cobro de factura" valor={formatoMoneda(resumen.ingresos.por_motivo.cobro_factura)} tenue />
            <Fila etiqueta="Otro ingreso" valor={formatoMoneda(resumen.ingresos.por_motivo.otro)} tenue />
            <Fila etiqueta="Retiros" valor={formatoMoneda(resumen.retiros.total)} />
            <Fila etiqueta="Retiro de caja" valor={formatoMoneda(resumen.retiros.por_motivo.retiro_caja)} tenue />
            <Fila etiqueta="Gasto menor" valor={formatoMoneda(resumen.retiros.por_motivo.gasto_menor)} tenue />
            <Fila etiqueta="Depósito al banco" valor={formatoMoneda(resumen.retiros.por_motivo.deposito_banco)} tenue />
            <Fila etiqueta="Otro retiro" valor={formatoMoneda(resumen.retiros.por_motivo.otro)} tenue />
          </div>

          <div className="border-border bg-card rounded-xl border p-3">
            <p className="mb-1 text-sm font-medium">Devoluciones</p>
            <Fila
              etiqueta={
                resumen.devoluciones.cantidad === 1 ? "1 devolución" : `${resumen.devoluciones.cantidad} devoluciones`
              }
              valor={formatoMoneda(resumen.devoluciones.total)}
            />
            <Fila etiqueta="Efectivo" valor={`−${formatoMoneda(resumen.devoluciones.efectivo)}`} negativo />
            <Fila etiqueta="Crédito" valor={formatoMoneda(resumen.devoluciones.credito)} />
          </div>

          <div className="border-border bg-card flex flex-col justify-center rounded-xl border p-3">
            <p className="text-sm font-medium">Efectivo esperado</p>
            <p className="text-2xl font-semibold tabular-nums">{formatoMoneda(resumen.efectivo.efectivo_esperado)}</p>
            <p className="text-muted-foreground mt-2 text-xs">
              {`Efectivo esperado = base inicial ${formatoMoneda(resumen.efectivo.base_inicial)} + ventas en efectivo ${formatoMoneda(
                resumen.efectivo.ventas_efectivo,
              )} + ingresos ${formatoMoneda(resumen.efectivo.ingresos_efectivo)} − retiros ${formatoMoneda(
                resumen.efectivo.retiros_efectivo,
              )} − devoluciones en efectivo ${formatoMoneda(resumen.efectivo.devoluciones_efectivo)}.`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
