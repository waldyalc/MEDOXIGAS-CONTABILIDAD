"use client";

import { BarraPaginacionAlegra } from "@/components/listas/barra-paginacion";
import { TAMANOS_PAGINA } from "@/lib/listas/parametros";

interface Props {
  total: number;
  /** Página actual en base 0, igual que `usePagina` de las fichas. */
  pagina: number;
  setPagina: (pagina: number) => void;
  porPagina?: number;
  /** Sustantivo del contador: "facturas", "documentos", "registros"… */
  etiqueta?: string;
  /** Tamaños ofrecidos; las opciones globales de Alegra siempre quedan disponibles. */
  opciones?: readonly number[];
  onCambiarPorPagina?: (porPagina: number) => void;
  mostrarSelectorTamano?: boolean;
  className?: string;
}

export function PaginadorLocal({
  total,
  pagina,
  setPagina,
  porPagina = 10,
  etiqueta = "registros",
  opciones = TAMANOS_PAGINA,
  onCambiarPorPagina,
  mostrarSelectorTamano = true,
  className,
}: Props) {
  if (total === 0) return null;

  const tamano = Math.max(1, porPagina);
  const totalPaginas = Math.max(1, Math.ceil(total / tamano));
  const actual = Math.min(Math.max(pagina, 0), totalPaginas - 1);
  const inicio = actual * tamano + 1;
  const fin = Math.min((actual + 1) * tamano, total);

  return (
    <BarraPaginacionAlegra
      pagina={actual + 1}
      totalPaginas={totalPaginas}
      inicio={inicio}
      fin={fin}
      total={total}
      tamano={tamano}
      opciones={opciones}
      mostrarSelectorTamano={mostrarSelectorTamano}
      onCambiarTamano={onCambiarPorPagina}
      onIrPagina={(destino) => setPagina(destino - 1)}
      sufijoRango={etiqueta}
      className={className}
    />
  );
}
