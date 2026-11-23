import type { FilaReporte } from "@/lib/reportes/estados/tipos";
import type { EstiloFila, FilaReporte as FilaExportada, TablaReporte, ValorCelda } from "@/lib/reportes/exportar/tipos";

interface Rotulos {
  cuenta: string;
  actual: string;
  anterior: string;
  porcentaje: string;
}

const ESTILO: Record<FilaReporte["clase"], EstiloFila> = {
  titulo: "grupo",
  grupo: "grupo",
  detalle: "normal",
  total: "total",
};

const COLUMNAS_NUMERICAS = [
  "actual",
  "porcentajeActual",
  "anterior",
  "porcentajeAnterior",
  "variacionAbsoluta",
  "variacionRelativa",
] as const;

function aFilaExportada(fila: FilaReporte): FilaExportada {
  const celdas: Record<string, ValorCelda> = {
    cuenta: fila.codigo === "" ? fila.nombre : `${fila.codigo} ${fila.nombre}`,
    actual: fila.actual,
    porcentajeActual: fila.porcentajeActual,
    anterior: fila.anterior,
    porcentajeAnterior: fila.porcentajeAnterior,
    variacionAbsoluta: fila.variacionAbsoluta,
    variacionRelativa: fila.variacionRelativa,
  };

  // Las filas de sección no llevan cifras.
  if (fila.clase === "titulo") {
    for (const clave of COLUMNAS_NUMERICAS) celdas[clave] = null;
  }

  return {
    celdas,
    estilo: ESTILO[fila.clase],
    ...(fila.clase === "detalle" ? { nivel: fila.nivel ?? 1 } : {}),
  };
}

/** La tabla del estado de resultados, lista para BotonDescargar (Excel o PDF). */
export function tablaEstadoResultados(
  filas: readonly FilaReporte[],
  rotulos: Rotulos,
  subtitulo: string,
): TablaReporte {
  return {
    titulo: "Estado de resultados",
    subtitulo,
    columnas: [
      { clave: "cuenta", titulo: rotulos.cuenta, tipo: "texto" },
      { clave: "actual", titulo: rotulos.actual, tipo: "dinero" },
      { clave: "porcentajeActual", titulo: rotulos.porcentaje, tipo: "porcentaje" },
      { clave: "anterior", titulo: rotulos.anterior, tipo: "dinero" },
      { clave: "porcentajeAnterior", titulo: rotulos.porcentaje, tipo: "porcentaje" },
      { clave: "variacionAbsoluta", titulo: "Var. Absoluta", tipo: "dinero" },
      { clave: "variacionRelativa", titulo: "Var. Relativa (%)", tipo: "porcentaje" },
    ],
    filas: filas.map(aFilaExportada),
  };
}
