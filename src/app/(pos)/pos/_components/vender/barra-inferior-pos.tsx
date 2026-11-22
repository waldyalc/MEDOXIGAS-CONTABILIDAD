"use client";

import Link from "next/link";

import { cn } from "cn";

import { PestanasVentaPos } from "./pestanas-venta-pos";

/**
 * Barra inferior del POS, de lado a lado bajo el catálogo y la factura, como
 * en Alegra: ventas pendientes y «+» a la izquierda; estado del turno con su
 * acción a la derecha. Mide 44 px, el alto medido en la referencia.
 */
export function BarraInferiorPos({
  turno,
  onAbrirTurno,
}: {
  turno: { id: string; numero: number } | null;
  onAbrirTurno: () => void;
}) {
  const abierto = turno !== null;

  return (
    <footer className="border-black/20 bg-slate-100 dark:bg-card dark:border-pos-linea flex h-11 shrink-0 items-stretch justify-between border-t print:hidden">
      <div className="flex min-w-0 flex-1 items-stretch">
        <PestanasVentaPos />
      </div>

      <div className="border-pos-linea flex shrink-0 items-center gap-2 border-l px-3 text-xs whitespace-nowrap">
        <span
          aria-hidden="true"
          className={cn("size-2 shrink-0 rounded-full", abierto ? "bg-pos-primario" : "bg-slate-400")}
        />
        <span className="text-pos-texto-suave">
          <span className="hidden sm:inline">
            {abierto && turno ? `Turno No ${turno.numero} abierto` : "Turno cerrado"}
          </span>
          <span className="sm:hidden">{abierto && turno ? `Turno ${turno.numero}` : "Turno cerrado"}</span>
        </span>
        {abierto ? (
          <Link href="/pos/turnos" className="text-pos-primario hover:text-pos-primario-hover font-medium">
            Cerrar turno
          </Link>
        ) : (
          <button
            type="button"
            className="text-pos-primario hover:text-pos-primario-hover font-medium"
            onClick={onAbrirTurno}
          >
            Abrir turno
          </button>
        )}
      </div>
    </footer>
  );
}
