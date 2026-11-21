"use client";

import type { ReactNode } from "react";

import { Eye, Printer } from "@/components/icons";
import {
  BarraLista,
  type ColumnaLista,
  PillEstado,
  TablaLista,
  TarjetaLista,
  type TonoPill,
} from "@/components/listas/tabla-lista";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";
import type { HistorialPOSFila } from "@/lib/pos/tipos";

const ETIQUETAS_METODO: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  cheque: "Cheque",
};

function tonoEstado(estado: HistorialPOSFila["estado"]): TonoPill {
  if (estado === "pagada") return "exito";
  if (estado === "anulada") return "peligro";
  return "pendiente";
}

function etiquetaEstado(estado: HistorialPOSFila["estado"]): string {
  if (estado === "pagada") return "Cobrada";
  if (estado === "anulada") return "Anulada";
  return "Por cobrar";
}

export function TablaVentasPos({
  filas,
  vacio,
  onVer,
  onImprimir,
  barra,
}: {
  filas: HistorialPOSFila[];
  vacio: { titulo: string; descripcion: string; filtrada?: boolean; accion?: ReactNode };
  onVer: (fila: HistorialPOSFila) => void;
  onImprimir: (fila: HistorialPOSFila) => void;
  barra?: ReactNode;
}) {
  const columnas: ColumnaLista<HistorialPOSFila>[] = [
    {
      clave: "ncf",
      encabezado: "NCF / No",
      celda: (fila) => (
        <button type="button" className="text-primary hover:underline" onClick={() => onVer(fila)}>
          {fila.ncf ?? `Factura No ${fila.numero}`}
        </button>
      ),
    },
    {
      clave: "fecha",
      encabezado: "Fecha",
      celda: (fila) => formatoDia(fila.fecha),
    },
    {
      clave: "cliente",
      encabezado: "Cliente",
      celda: (fila) => <span className="block max-w-[200px] truncate">{fila.cliente_nombre}</span>,
    },
    {
      clave: "terminal",
      encabezado: "Terminal",
      celda: (fila) => fila.terminal_nombre ?? "—",
      className: "hidden xl:table-cell",
    },
    {
      clave: "turno",
      encabezado: "Turno",
      celda: (fila) => (fila.turno_numero != null ? `#${fila.turno_numero}` : "—"),
      className: "hidden xl:table-cell",
    },
    {
      clave: "metodos",
      encabezado: "Métodos",
      celda: (fila) =>
        fila.metodos.length === 0 ? (
          <Badge variant="secondary">Crédito</Badge>
        ) : (
          <div className="flex flex-wrap gap-1">
            {fila.metodos.map((metodo) => (
              <Badge key={metodo} variant="outline">
                {ETIQUETAS_METODO[metodo] ?? metodo}
              </Badge>
            ))}
          </div>
        ),
    },
    {
      clave: "total",
      encabezado: "Total",
      alineacion: "derecha",
      celda: (fila) => formatoMoneda(fila.total),
    },
    {
      clave: "saldo",
      encabezado: "Saldo",
      alineacion: "derecha",
      celda: (fila) => {
        const saldo = Number(fila.saldo);
        if (fila.estado === "anulada" || saldo <= 0) return <span className="text-muted-foreground">—</span>;
        return <span className="text-destructive">{formatoMoneda(fila.saldo)}</span>;
      },
    },
    {
      clave: "estado",
      encabezado: "Estado",
      celda: (fila) => <PillEstado tono={tonoEstado(fila.estado)}>{etiquetaEstado(fila.estado)}</PillEstado>,
    },
  ];

  return (
    <TarjetaLista data-lista="pos-historial">
      {barra ? <BarraLista className="h-auto flex-wrap py-2">{barra}</BarraLista> : null}
      <div className="overflow-x-auto">
        <TablaLista
          columnas={columnas}
          filas={filas}
          claveFila={(fila) => fila.id}
          vacio={vacio}
          acciones={(fila) => (
            <div className="flex items-center justify-center gap-0.5">
              <Button variant="ghost" size="icon" aria-label="Ver detalle" onClick={() => onVer(fila)}>
                <Eye aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Reimprimir ticket" onClick={() => onImprimir(fila)}>
                <Printer aria-hidden="true" />
              </Button>
            </div>
          )}
        />
      </div>
    </TarjetaLista>
  );
}
