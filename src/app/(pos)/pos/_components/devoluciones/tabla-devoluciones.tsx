"use client";

import type { ReactNode } from "react";

import { Eye, Printer } from "@/components/icons";
import { BarraLista, type ColumnaLista, PillEstado, TablaLista, TarjetaLista } from "@/components/listas/tabla-lista";
import { Button } from "@/components/ui/button";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";
import { centavosATexto, centavosDeDecimal } from "@/lib/pos/calculo";

import type { DevolucionPOSFila } from "../tipos";

function etiquetaReembolso(fila: DevolucionPOSFila): string {
  if (fila.tipo_reembolso === "credito_factura") return `Crédito ${formatoMoneda(fila.total)}`;
  if (fila.tipo_reembolso === "efectivo") return `Efectivo ${formatoMoneda(fila.total)}`;
  const efectivo = fila.monto_reembolso_efectivo;
  const credito = centavosATexto((centavosDeDecimal(fila.total) ?? 0) - (centavosDeDecimal(efectivo) ?? 0));
  return `Combinado ${formatoMoneda(efectivo)} + ${formatoMoneda(credito)}`;
}

export function TablaDevoluciones({
  filas,
  vacio,
  onVer,
  onImprimir,
  barra,
}: {
  filas: DevolucionPOSFila[];
  vacio: { titulo: string; descripcion: string; filtrada?: boolean; accion?: ReactNode };
  onVer: (fila: DevolucionPOSFila) => void;
  onImprimir: (fila: DevolucionPOSFila) => void;
  barra?: ReactNode;
}) {
  const columnas: ColumnaLista<DevolucionPOSFila>[] = [
    {
      clave: "ncf",
      encabezado: "NCF",
      celda: (fila) => (
        <button type="button" className="text-primary hover:underline" onClick={() => onVer(fila)}>
          {fila.ncf}
        </button>
      ),
    },
    {
      clave: "fecha",
      encabezado: "Fecha",
      celda: (fila) => formatoDia(fila.fecha),
    },
    {
      clave: "factura",
      encabezado: "Factura origen",
      celda: (fila) => fila.factura_ncf ?? `No ${fila.factura_numero}`,
      className: "hidden lg:table-cell",
    },
    {
      clave: "cliente",
      encabezado: "Cliente",
      celda: (fila) => <span className="block max-w-[200px] truncate">{fila.cliente_nombre}</span>,
    },
    {
      clave: "total",
      encabezado: "Total",
      alineacion: "derecha",
      celda: (fila) => formatoMoneda(fila.total),
    },
    {
      clave: "reembolso",
      encabezado: "Reembolso",
      celda: (fila) => etiquetaReembolso(fila),
      className: "hidden md:table-cell",
    },
    {
      clave: "estado",
      encabezado: "Estado",
      celda: (fila) => (
        <PillEstado tono={fila.estado === "anulada" ? "peligro" : "exito"}>
          {fila.estado === "anulada" ? "Anulada" : "Activa"}
        </PillEstado>
      ),
    },
  ];

  return (
    <TarjetaLista data-lista="pos-devoluciones">
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
              <Button variant="ghost" size="icon" aria-label="Imprimir ticket" onClick={() => onImprimir(fila)}>
                <Printer aria-hidden="true" />
              </Button>
            </div>
          )}
        />
      </div>
    </TarjetaLista>
  );
}
