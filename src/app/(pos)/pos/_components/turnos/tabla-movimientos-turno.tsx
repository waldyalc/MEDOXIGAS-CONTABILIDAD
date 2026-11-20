"use client";

import { cn } from "cn";
import { Eye, RotateCcw } from "lucide-react";

import { type ColumnaLista, PillEstado, TablaLista, TarjetaLista } from "@/components/listas/tabla-lista";
import { Button } from "@/components/ui/button";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoFechaHora } from "@/lib/formato";
import type { MotivoMovimientoPOS, MovimientoTurnoPOS } from "@/lib/pos/tipos";

const MOTIVOS: Record<MotivoMovimientoPOS, string> = {
  fondo_caja: "Fondo de caja",
  cobro_factura: "Cobro de factura",
  retiro_caja: "Retiro de caja",
  gasto_menor: "Gasto menor",
  deposito_banco: "Depósito al banco",
  otro: "Otro",
};

const MOTIVOS_CON_INVERSO = new Set<MotivoMovimientoPOS>(["fondo_caja", "retiro_caja", "deposito_banco", "otro"]);

export function TablaMovimientosTurno({
  movimientos,
  onVer,
  onInverso,
  permitirInverso = true,
}: {
  movimientos: MovimientoTurnoPOS[];
  onVer: (movimiento: MovimientoTurnoPOS) => void;
  onInverso: (movimiento: MovimientoTurnoPOS) => void;
  permitirInverso?: boolean;
}) {
  const columnas: ColumnaLista<MovimientoTurnoPOS>[] = [
    {
      clave: "recibo",
      encabezado: "Recibo",
      celda: (fila) => <span className="font-mono text-xs">{`#${fila.numero}`}</span>,
      className: "w-20",
    },
    {
      clave: "hora",
      encabezado: "Hora",
      celda: (fila) => <span className="text-xs">{formatoFechaHora(fila.creado_en)}</span>,
    },
    {
      clave: "tipo",
      encabezado: "Tipo",
      celda: (fila) => (fila.tipo === "ingreso" ? "Ingreso" : "Retiro"),
    },
    {
      clave: "motivo",
      encabezado: "Motivo",
      celda: (fila) => MOTIVOS[fila.motivo],
    },
    {
      clave: "detalle",
      encabezado: "Detalle",
      celda: (fila) => (fila.factura_numero ? `Factura No ${fila.factura_numero}` : (fila.notas ?? "—")),
      className: "max-w-[220px] truncate",
    },
    {
      clave: "cuenta",
      encabezado: "Cuenta",
      celda: (fila) => fila.cuenta_nombre ?? "—",
      className: "hidden lg:table-cell",
    },
    {
      clave: "monto",
      encabezado: "Monto",
      alineacion: "derecha",
      celda: (fila) => (
        <div className="flex flex-col items-end gap-0.5">
          <span
            className={cn(fila.tipo === "retiro" && "text-destructive", !fila.vigente && "line-through opacity-60")}
          >
            {`${fila.tipo === "retiro" ? "−" : "+"}${formatoMoneda(fila.monto)}`}
          </span>
          {fila.vigente ? null : <PillEstado tono="neutro">No vigente</PillEstado>}
        </div>
      ),
    },
  ];

  return (
    <TarjetaLista>
      <div className="overflow-x-auto">
        <TablaLista
          columnas={columnas}
          filas={movimientos}
          claveFila={(fila) => fila.id}
          densidad="compacta"
          vacio={{
            titulo: "Este turno no tiene movimientos.",
            descripcion: "Las ventas, cobros y retiros aparecerán aquí.",
          }}
          acciones={(fila) => (
            <div className="flex items-center justify-center gap-0.5">
              <Button variant="ghost" size="icon" aria-label="Ver recibo" onClick={() => onVer(fila)}>
                <Eye aria-hidden="true" />
              </Button>
              {permitirInverso && MOTIVOS_CON_INVERSO.has(fila.motivo) && fila.vigente ? (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Registrar movimiento inverso"
                  title="Registrar movimiento inverso"
                  onClick={() => onInverso(fila)}
                >
                  <RotateCcw aria-hidden="true" />
                </Button>
              ) : null}
            </div>
          )}
        />
      </div>
      {movimientos.some((fila) => !fila.vigente) ? (
        <div className="px-4 py-2">
          <PillEstado tono="neutro">Los movimientos no vigentes no suman.</PillEstado>
        </div>
      ) : null}
    </TarjetaLista>
  );
}
