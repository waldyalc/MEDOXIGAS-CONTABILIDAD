"use client";

import Link from "next/link";

import { usePagina } from "@/components/ficha/ficha-ui";
import { PaginadorLocal } from "@/components/listas/paginador-local";
import { type ColumnaLista, PillEstado, TablaLista } from "@/components/listas/tabla-lista";
import { Button } from "@/components/ui/button";
import { formatoMoneda } from "@/lib/facturacion/formato";
import type { PeriodoNomina, ReciboNomina } from "@/lib/nomina/tipos";

import {
  ETIQUETA_ESTADO_NOMINA,
  etiquetaPeriodoCorta,
  formatoDias,
  RUTA_PERIODOS,
  rutaAsientoNomina,
  rutaReciboNomina,
  TONO_ESTADO_NOMINA,
} from "../../_components/formato-nomina";

export interface FilaReciboEmpleado {
  readonly recibo: ReciboNomina;
  readonly periodo: PeriodoNomina | null;
}

const POR_PAGINA = 10;

const COLUMNAS: readonly ColumnaLista<FilaReciboEmpleado>[] = [
  {
    clave: "periodo",
    encabezado: "Periodo",
    celda: ({ recibo, periodo }) => (
      <div className="flex flex-col">
        <span className="font-medium">
          {periodo ? etiquetaPeriodoCorta(periodo.fecha_inicio, periodo.fecha_fin) : recibo.periodo_codigo}
        </span>
        <span className="text-muted-foreground font-mono text-xs">{recibo.periodo_codigo}</span>
      </div>
    ),
  },
  {
    clave: "dias",
    encabezado: "Días",
    alineacion: "derecha",
    celda: ({ recibo }) => formatoDias(recibo.dias_trabajados),
  },
  {
    clave: "ingresos",
    encabezado: "Ingresos",
    alineacion: "derecha",
    celda: ({ recibo }) => formatoMoneda(recibo.total_ingresos),
  },
  {
    clave: "deducciones",
    encabezado: "Deducciones",
    alineacion: "derecha",
    celda: ({ recibo }) => formatoMoneda(recibo.total_deducciones),
  },
  {
    clave: "neto",
    encabezado: "Neto",
    alineacion: "derecha",
    celda: ({ recibo }) => <span className="font-semibold">{formatoMoneda(recibo.neto_pagar)}</span>,
  },
  {
    clave: "estado",
    encabezado: "Estado",
    celda: ({ recibo }) => (
      <PillEstado tono={TONO_ESTADO_NOMINA[recibo.estado]}>{ETIQUETA_ESTADO_NOMINA[recibo.estado]}</PillEstado>
    ),
  },
  {
    clave: "asiento",
    encabezado: "Asiento",
    className: "hidden md:table-cell",
    celda: ({ recibo }) =>
      recibo.asiento_id ? (
        <Link
          href={rutaAsientoNomina(recibo.asiento_id)}
          prefetch={false}
          className="text-primary font-mono text-xs font-medium"
          aria-label="Ver asiento del recibo"
        >
          Ver asiento
        </Link>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
];

export function TablaRecibos({
  filas,
  puedeEscribir,
}: {
  filas: readonly FilaReciboEmpleado[];
  puedeEscribir: boolean;
}) {
  const { pagina, setPagina } = usePagina(filas.length, POR_PAGINA);
  const visibles = filas.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);

  return (
    <div className="flex flex-col gap-4">
      <TablaLista
        columnas={COLUMNAS}
        filas={visibles}
        claveFila={(fila) => fila.recibo.id}
        densidad="compacta"
        filaHref={(fila) => rutaReciboNomina(fila.recibo.id)}
        vacio={{
          titulo: "Todavía no tiene recibos.",
          descripcion: "Crea un periodo para calcular su nómina.",
          accion: puedeEscribir ? (
            <Button size="sm" render={<Link href={RUTA_PERIODOS} prefetch={false} />}>
              Ir a Periodos
            </Button>
          ) : (
            <Link href={RUTA_PERIODOS} prefetch={false} className="text-primary text-sm font-medium underline">
              Ir a Periodos
            </Link>
          ),
        }}
      />
      {filas.length > POR_PAGINA ? (
        <PaginadorLocal
          total={filas.length}
          pagina={pagina}
          setPagina={setPagina}
          porPagina={POR_PAGINA}
          etiqueta="recibos"
        />
      ) : null}
    </div>
  );
}
