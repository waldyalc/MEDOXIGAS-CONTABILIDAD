import { centavos } from "../dinero";
import type { FilaMovimiento } from "./tipos";

export interface OpcionesLibroDiario {
  pagina: number;
  porPagina: number;
}

export interface FilaLibroDiarioCalculada {
  clave: string;
  asientoNumero: number;
  estado: string;
  fecha: string;
  tercero: string;
  cuentaCodigo: string;
  cuentaNombre: string;
  centroCosto: string;
  debito: number;
  credito: number;
}

export interface TotalesLibroDiario {
  debitos: number;
  creditos: number;
}

export interface LibroDiarioCalculado {
  filas: FilaLibroDiarioCalculada[];
  totalFilas: number;
  pagina: number;
  porPagina: number;
  totalPaginas: number;
  rangoTexto: string;
  totales: TotalesLibroDiario;
}

export function calcularLibroDiario(
  filas: readonly FilaMovimiento[],
  opciones: OpcionesLibroDiario,
): LibroDiarioCalculado {
  const ordenadas = [...filas].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.asiento_numero - b.asiento_numero);

  const porPagina = Math.max(1, Math.trunc(opciones.porPagina));
  const totalPaginas = Math.max(1, Math.ceil(ordenadas.length / porPagina));
  const pagina = Math.min(Math.max(1, Math.trunc(opciones.pagina)), totalPaginas);
  const inicio = (pagina - 1) * porPagina;
  const visibles = ordenadas.slice(inicio, inicio + porPagina);

  const totales = ordenadas.reduce<TotalesLibroDiario>(
    (acumulado, fila) => ({
      debitos: acumulado.debitos + centavos(fila.debito),
      creditos: acumulado.creditos + centavos(fila.credito),
    }),
    { debitos: 0, creditos: 0 },
  );

  return {
    filas: visibles.map((fila, indice) => ({
      clave: `${fila.asiento_id}-${inicio + indice}`,
      asientoNumero: fila.asiento_numero,
      estado: fila.estado || "Contabilizado",
      fecha: fila.fecha,
      tercero: fila.tercero ?? "",
      cuentaCodigo: fila.cuenta_codigo,
      cuentaNombre: fila.cuenta_nombre,
      centroCosto: "",
      debito: centavos(fila.debito),
      credito: centavos(fila.credito),
    })),
    totalFilas: ordenadas.length,
    pagina,
    porPagina,
    totalPaginas,
    rangoTexto:
      ordenadas.length === 0
        ? "0 de 0"
        : `${inicio + 1}–${Math.min(inicio + porPagina, ordenadas.length)} de ${ordenadas.length}`,
    totales,
  };
}
