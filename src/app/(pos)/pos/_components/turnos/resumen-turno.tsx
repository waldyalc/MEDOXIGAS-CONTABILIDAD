import type { ReactNode } from "react";

import { cn } from "cn";

import { PillEstado } from "@/components/listas/tabla-lista";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoFechaHora } from "@/lib/formato";
import { centavosATexto, centavosDeDecimal, compararMontos } from "@/lib/pos/calculo";
import type { ResumenTurnoVista } from "@/lib/pos/tipos";

function FilaMovimiento({
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
  const montoNegativo = negativo && compararMontos(valor, "0") > 0;
  return (
    <div className="border-border flex items-baseline justify-between gap-3 border-b px-4 py-2.5 text-sm last:border-b-0">
      <span className={cn(tenue ? "text-muted-foreground" : "")}>{etiqueta}</span>
      <span
        className={cn("tabular-nums", montoNegativo ? "text-destructive" : "", tenue ? "text-muted-foreground" : "")}
      >
        {montoNegativo ? `−${formatoMoneda(valor)}` : formatoMoneda(valor)}
      </span>
    </div>
  );
}

function diferenciaTexto(diferencia: string | null): { texto: string; faltante: boolean } {
  const centavos = centavosDeDecimal(diferencia ?? "0") ?? 0;
  if (centavos === 0) return { texto: "La caja cuadra", faltante: false };
  const monto = formatoMoneda(centavosATexto(Math.abs(centavos)));
  return centavos > 0
    ? { texto: `Sobrante ${monto}`, faltante: false }
    : { texto: `Faltante ${monto}`, faltante: true };
}

/** Detalle de un turno estilo Alegra: pill, tarjeta de movimientos y caja destacada de efectivo. */
export function ResumenTurno({ vista, acciones }: { vista: ResumenTurnoVista; acciones?: ReactNode }) {
  const { turno, resumen } = vista;
  const esperadoNegativo = compararMontos(resumen.efectivo.efectivo_esperado, "0") < 0;
  const cerrado = turno.estado === "cerrado" || resumen.efectivo.congelado;
  const diferencia = diferenciaTexto(resumen.efectivo.diferencia);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">
            {cerrado ? `Cierre No ${turno.numero}` : `Turno No ${turno.numero}`}
          </h2>
          <PillEstado tono={cerrado ? "peligro" : "exito"}>{cerrado ? "CERRADO" : "ABIERTO"}</PillEstado>
        </div>
        {acciones ? <div className="flex flex-wrap items-center gap-2">{acciones}</div> : null}
      </div>

      <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
        <span>
          {turno.cerrado_en
            ? `Cerrado ${formatoFechaHora(turno.cerrado_en)}`
            : `Abierto desde ${formatoFechaHora(turno.abierto_en)}`}
        </span>
        <span>
          {turno.cerrado_en
            ? `Abierto por ${turno.abierto_por_nombre ?? "—"} · Cerrado por ${turno.cerrado_por_nombre ?? "—"}`
            : `Abierto por ${turno.abierto_por_nombre ?? "—"}`}
        </span>
      </div>

      {esperadoNegativo ? (
        <Alert variant="destructive">
          <AlertDescription>
            El efectivo esperado es negativo; revisa los pagos y devoluciones del turno antes de cerrar.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="border-border bg-card rounded-xl border">
        <div className="border-border flex items-start justify-between gap-3 border-b px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground text-xs">Fecha de inicio</span>
            <span className="text-sm">{formatoFechaHora(turno.abierto_en)}</span>
          </div>
          <div className="flex flex-col items-end gap-0.5 text-right">
            <span className="text-muted-foreground text-xs">Total de ventas</span>
            <span className="text-sm font-semibold tabular-nums">{formatoMoneda(resumen.ventas.total)}</span>
            <span className="text-muted-foreground text-xs">
              {resumen.ventas.cantidad === 1 ? "1 venta" : `${resumen.ventas.cantidad} ventas`}
            </span>
          </div>
        </div>

        <FilaMovimiento etiqueta="Base inicial" valor={resumen.efectivo.base_inicial} />
        <FilaMovimiento etiqueta="Ventas en efectivo" valor={resumen.ventas.por_metodo.efectivo} />
        <FilaMovimiento
          etiqueta="Ventas con tarjeta"
          valor={resumen.ventas.por_metodo.tarjeta}
          tenue={compararMontos(resumen.ventas.por_metodo.tarjeta, "0") === 0}
        />
        <FilaMovimiento
          etiqueta="Ventas por transferencia"
          valor={resumen.ventas.por_metodo.transferencia}
          tenue={compararMontos(resumen.ventas.por_metodo.transferencia, "0") === 0}
        />
        <FilaMovimiento etiqueta="Ventas a crédito" valor={resumen.ventas.por_metodo.credito} tenue />
        <FilaMovimiento etiqueta="Devolución de dinero" valor={resumen.devoluciones.efectivo} negativo />
        <FilaMovimiento etiqueta="Ingresos en efectivo" valor={resumen.ingresos.total} />
        <FilaMovimiento etiqueta="Retiros en efectivo" valor={resumen.retiros.total} negativo />
        <div className="border-border flex items-baseline justify-between gap-3 border-t-2 px-4 py-3 text-sm font-semibold">
          <span>Total de movimientos del turno</span>
          <span className="tabular-nums">{formatoMoneda(resumen.efectivo.efectivo_esperado)}</span>
        </div>
      </div>

      <div className="bg-muted/50 flex flex-col gap-2 rounded-xl px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-semibold">
            {cerrado ? "Dinero en efectivo del cierre" : "Dinero esperado en caja"}
          </span>
          <span className="text-2xl font-semibold tabular-nums">
            {formatoMoneda(resumen.efectivo.efectivo_esperado)}
          </span>
        </div>
        <p className="text-muted-foreground text-xs">
          Base inicial más las ventas e ingresos en efectivo, menos las devoluciones y los retiros.
          {cerrado ? " Quedó congelado al cerrar." : ""}
        </p>
        {cerrado && resumen.efectivo.efectivo_real !== null ? (
          <div className="border-border flex flex-col gap-1 border-t pt-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Efectivo real contado</span>
              <span className="tabular-nums">{formatoMoneda(resumen.efectivo.efectivo_real)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Diferencia</span>
              <span className={cn("font-medium", diferencia.faltante ? "text-destructive" : "")}>
                {diferencia.texto}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {turno.observaciones ? (
        <div className="border-border bg-card rounded-xl border px-4 py-3 text-sm">
          <p className="font-medium">Observaciones</p>
          <p className="text-muted-foreground">{turno.observaciones}</p>
        </div>
      ) : null}
    </div>
  );
}
