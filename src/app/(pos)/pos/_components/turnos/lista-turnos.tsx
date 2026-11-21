"use client";

import type { ReactNode } from "react";

import { cn } from "cn";
import { Loader2 } from "lucide-react";

import { PillEstado } from "@/components/listas/tabla-lista";
import { formatoFechaHora } from "@/lib/formato";
import type { TurnoPOS } from "@/lib/pos/tipos";

export const SELECCION_ACTUAL = "actual";

function ItemTurno({
  titulo,
  subtitulo,
  seleccionado,
  cargando,
  pill,
  onClick,
}: {
  titulo: string;
  subtitulo: string;
  seleccionado: boolean;
  cargando?: boolean;
  pill?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-current={seleccionado || undefined}
      className={cn(
        "hover:bg-slate-200/45 dark:hover:bg-white/[0.06] flex w-full flex-col gap-0.5 px-4 py-2.5 text-left",
        seleccionado && "bg-slate-200/45 dark:bg-white/[0.08]",
      )}
      onClick={onClick}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{titulo}</span>
        {cargando ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" /> : pill}
      </span>
      <span className="text-muted-foreground truncate text-xs">{subtitulo}</span>
    </button>
  );
}

/** Lista maestra de la izquierda: el turno vigente primero y debajo los cierres paginados. */
export function ListaTurnos({
  actual,
  cierres,
  terminales,
  todas,
  seleccionado,
  cargandoId,
  onSeleccionar,
}: {
  actual: TurnoPOS | null;
  cierres: TurnoPOS[];
  terminales: { id: string; nombre: string }[];
  todas: boolean;
  seleccionado: string;
  cargandoId: string | null;
  onSeleccionar: (clave: string) => void;
}) {
  const nombreTerminal = (id: string) => terminales.find((terminal) => terminal.id === id)?.nombre ?? "—";

  return (
    <div className="divide-border flex flex-col divide-y">
      {actual ? (
        <ItemTurno
          titulo="Turno en curso"
          subtitulo={
            actual.estado === "abierto"
              ? `Abierto ${formatoFechaHora(actual.abierto_en)}`
              : `Cerrado ${formatoFechaHora(actual.cerrado_en)}`
          }
          seleccionado={seleccionado === SELECCION_ACTUAL}
          pill={
            <PillEstado tono={actual.estado === "abierto" ? "exito" : "peligro"}>
              {actual.estado === "abierto" ? "ABIERTO" : "CERRADO"}
            </PillEstado>
          }
          onClick={() => onSeleccionar(SELECCION_ACTUAL)}
        />
      ) : null}

      {cierres.map((cierre) => (
        <ItemTurno
          key={cierre.id}
          titulo={`Cierre No ${cierre.numero}`}
          subtitulo={`${formatoFechaHora(cierre.cerrado_en)}${todas ? ` · ${nombreTerminal(cierre.terminal_id)}` : ""}`}
          seleccionado={seleccionado === cierre.id}
          cargando={cargandoId === cierre.id}
          pill={null}
          onClick={() => onSeleccionar(cierre.id)}
        />
      ))}

      {cierres.length === 0 ? (
        <p className="text-muted-foreground px-4 py-6 text-center text-sm">Todavía no hay cierres.</p>
      ) : null}
    </div>
  );
}
