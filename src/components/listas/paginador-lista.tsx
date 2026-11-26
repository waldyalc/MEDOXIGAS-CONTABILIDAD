"use client";

import { useRouter } from "next/navigation";

import { BarraPaginacionAlegra } from "@/components/listas/barra-paginacion";
import {
  leerTamano,
  type ParametrosLista,
  type ResumenPagina,
  TAMANOS_PAGINA,
  urlLista,
} from "@/lib/listas/parametros";

interface Props {
  base: string;
  params: ParametrosLista;
  resumen: ResumenPagina;
  className?: string;
  /** Texto que precede al selector de tamaño, p. ej. "Ítems por página". */
  etiqueta?: string;
  /** Tamaño actual de la página; por defecto se lee de la URL. */
  tamano?: number;
  /** Tamaños ofrecidos; las opciones globales de Alegra siempre quedan disponibles. */
  opciones?: readonly number[];
  /** Permite ocultar el pie desde la página. */
  visible?: boolean;
  /** Con total 0 el pie se conserva (búsqueda sin resultados), como en Facturas. */
  mostrarEnVacio?: boolean;
  /** ‹‹ ›› en los extremos. */
  botonesExtremos?: boolean;
  /** Permite ocultar el selector cuando una lista especial no cambia de tamaño. */
  mostrarSelectorTamano?: boolean;
}

export function PaginadorLista({
  base,
  params,
  resumen,
  className,
  etiqueta = "Ítems por página:",
  tamano,
  opciones = TAMANOS_PAGINA,
  visible = true,
  mostrarEnVacio = false,
  botonesExtremos = false,
  mostrarSelectorTamano = true,
}: Props) {
  const router = useRouter();

  if (!visible || (resumen.total === 0 && !mostrarEnVacio)) return null;

  const { pagina, totalPaginas, inicio, fin, total } = resumen;
  const tamanoActual = tamano ?? leerTamano(params);

  function cambiarTamano(nuevoTamano: number) {
    if (nuevoTamano === tamanoActual) return;
    router.push(urlLista(base, params, { tamano: String(nuevoTamano), pagina: null }), { scroll: false });
  }

  function irPagina(destino: number) {
    if (destino === pagina) return;
    router.push(urlLista(base, params, { pagina: String(destino) }), { scroll: false });
  }

  return (
    <BarraPaginacionAlegra
      pagina={pagina}
      totalPaginas={totalPaginas}
      inicio={inicio}
      fin={fin}
      total={total}
      tamano={tamanoActual}
      opciones={opciones}
      mostrarSelectorTamano={mostrarSelectorTamano}
      onCambiarTamano={cambiarTamano}
      onIrPagina={irPagina}
      hrefPagina={(destino) => urlLista(base, params, { pagina: String(destino) })}
      etiquetaTamano={etiqueta}
      botonesExtremos={botonesExtremos}
      className={className}
    />
  );
}
