import type { ReactNode } from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

import { EstadoVacio } from "./estado-vacio";
import { TituloWidget } from "./titulo-widget";

export interface FilaTop {
  clave: string;
  /** Texto del avatar (referencia o iniciales). */
  avatar: string;
  nombre: ReactNode;
  cantidad: string;
  total: string;
}

interface Props {
  titulo: string;
  href: string;
  tooltip: string;
  subtitulo: string;
  /** Encabezado de la columna de conteo («Nº items» / «Nº documentos»). */
  columnaCantidad: string;
  filas: readonly FilaTop[];
  vacioTitulo: string;
  vacioDetalle: string;
}

/** Card de tabla del Inicio: avatar + concepto, conteo y total vendido. */
export function TablaTop({
  titulo,
  href,
  tooltip,
  subtitulo,
  columnaCantidad,
  filas,
  vacioTitulo,
  vacioDetalle,
}: Props) {
  return (
    <Card className="ring-border h-full gap-0 rounded-2xl [--card-spacing:--spacing(6)]">
      <CardHeader className="flex flex-col gap-0.5">
        <TituloWidget titulo={titulo} href={href} tooltip={tooltip} />
        <p className="text-muted-foreground text-xs">{subtitulo}</p>
      </CardHeader>
      <CardContent>
        {filas.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-left text-[11px] font-medium tracking-wide uppercase">
                <th className="pb-2 font-medium">Concepto</th>
                <th className="w-20 pb-2 text-center font-medium">{columnaCantidad}</th>
                <th className="w-28 pb-2 text-right font-medium">Total vendido</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <tr key={fila.clave} className="border-border/60 border-t">
                  <td className="py-2.5 pr-2">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-medium">
                        {fila.avatar}
                      </span>
                      <span className="truncate">{fila.nombre}</span>
                    </span>
                  </td>
                  <td className="py-2.5 text-center tabular-nums">{fila.cantidad}</td>
                  <td className="py-2.5 text-right whitespace-nowrap tabular-nums">{fila.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EstadoVacio className="min-h-56" titulo={vacioTitulo} detalle={vacioDetalle} />
        )}
      </CardContent>
    </Card>
  );
}
