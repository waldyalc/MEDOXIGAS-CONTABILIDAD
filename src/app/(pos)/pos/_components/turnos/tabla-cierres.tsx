"use client";

import { Eye, Printer } from "@/components/icons";
import { type ColumnaLista, TablaLista, TarjetaLista } from "@/components/listas/tabla-lista";
import { Button } from "@/components/ui/button";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoFechaHora } from "@/lib/formato";
import { centavosATexto, centavosDeDecimal } from "@/lib/pos/calculo";
import type { TurnoPOS } from "@/lib/pos/tipos";

function diferenciaTexto(turno: TurnoPOS): string {
  const centavos = (centavosDeDecimal(turno.diferencia ?? "0") ?? 0) || 0;
  if (centavos === 0) return "Cuadra";
  const monto = formatoMoneda(centavosATexto(Math.abs(centavos)));
  return centavos > 0 ? `Sobrante ${monto}` : `Faltante ${monto}`;
}

export function TablaCierres({
  filas,
  terminales,
  todas,
  onVer,
  onImprimir,
}: {
  filas: TurnoPOS[];
  terminales: { id: string; nombre: string }[];
  todas: boolean;
  onVer: (turno: TurnoPOS) => void;
  onImprimir: (turno: TurnoPOS) => void;
}) {
  const columnas: ColumnaLista<TurnoPOS>[] = [
    {
      clave: "numero",
      encabezado: "Cierre No",
      celda: (fila) => <span className="font-mono text-xs">{`#${fila.numero}`}</span>,
      className: "w-24",
    },
    ...(todas
      ? [
          {
            clave: "terminal",
            encabezado: "Terminal",
            celda: (fila: TurnoPOS) => terminales.find((terminal) => terminal.id === fila.terminal_id)?.nombre ?? "—",
          },
        ]
      : []),
    {
      clave: "abierto",
      encabezado: "Abierto",
      celda: (fila) => <span className="text-xs">{formatoFechaHora(fila.abierto_en)}</span>,
    },
    {
      clave: "cerrado",
      encabezado: "Cerrado",
      celda: (fila) => <span className="text-xs">{formatoFechaHora(fila.cerrado_en)}</span>,
    },
    {
      clave: "base",
      encabezado: "Base",
      alineacion: "derecha",
      celda: (fila) => formatoMoneda(fila.base_inicial),
      className: "hidden lg:table-cell",
    },
    {
      clave: "esperado",
      encabezado: "Esperado",
      alineacion: "derecha",
      celda: (fila) => formatoMoneda(fila.efectivo_esperado ?? "0"),
    },
    {
      clave: "real",
      encabezado: "Real",
      alineacion: "derecha",
      celda: (fila) => formatoMoneda(fila.efectivo_real ?? "0"),
    },
    {
      clave: "diferencia",
      encabezado: "Diferencia",
      celda: (fila) => {
        const centavos = centavosDeDecimal(fila.diferencia ?? "0") ?? 0;
        return <span className={centavos < 0 ? "text-destructive" : ""}>{diferenciaTexto(fila)}</span>;
      },
    },
  ];

  return (
    <TarjetaLista>
      <div className="overflow-x-auto">
        <TablaLista
          columnas={columnas}
          filas={filas}
          claveFila={(fila) => fila.id}
          vacio={{
            titulo: "No hay cierres de turno.",
            descripcion: "Los cierres aparecerán aquí cuando cierres un turno.",
          }}
          acciones={(fila) => (
            <div className="flex items-center justify-center gap-0.5">
              <Button variant="ghost" size="icon" aria-label="Ver cierre" onClick={() => onVer(fila)}>
                <Eye aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Imprimir cierre" onClick={() => onImprimir(fila)}>
                <Printer aria-hidden="true" />
              </Button>
            </div>
          )}
        />
      </div>
    </TarjetaLista>
  );
}
