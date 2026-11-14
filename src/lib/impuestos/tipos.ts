export type TipoImpuesto = "ninguno" | "itbis" | "otro" | "propina" | "exento";

export interface Impuesto {
  id: string;
  codigo: string;
  nombre: string;
  tipo: TipoImpuesto;
  tarifa: number;
  cuenta_id: string | null;
  activo: boolean;
  orden: number;
}

export interface GrupoImpuestos {
  tipo: Exclude<TipoImpuesto, "ninguno">;
  etiqueta: string;
  impuestos: Impuesto[];
}

const ETIQUETAS_GRUPO: Record<Exclude<TipoImpuesto, "ninguno">, string> = {
  itbis: "ITBIS",
  otro: "Otro",
  propina: "Propina legal",
  exento: "Exento (E)",
};

const ORDEN_GRUPO: Record<Exclude<TipoImpuesto, "ninguno">, number> = {
  itbis: 10,
  otro: 20,
  propina: 30,
  exento: 40,
};

export function etiquetaImpuesto(impuesto: Impuesto): string {
  if (impuesto.tipo === "ninguno") return "Ninguno";
  return `${impuesto.nombre} (${impuesto.tarifa.toFixed(2)}%)`;
}

export function agruparImpuestos(impuestos: readonly Impuesto[]): GrupoImpuestos[] {
  const grupos = new Map<Exclude<TipoImpuesto, "ninguno">, Impuesto[]>();

  for (const impuesto of impuestos) {
    if (impuesto.tipo === "ninguno") continue;
    const lista = grupos.get(impuesto.tipo) ?? [];
    lista.push(impuesto);
    grupos.set(impuesto.tipo, lista);
  }

  return [...grupos.entries()]
    .sort(([tipoA], [tipoB]) => ORDEN_GRUPO[tipoA] - ORDEN_GRUPO[tipoB])
    .map(([tipo, lista]) => ({
      tipo,
      etiqueta: ETIQUETAS_GRUPO[tipo],
      impuestos: [...lista].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre)),
    }));
}

export function impuestoNinguno(impuestos: readonly Impuesto[] | null | undefined): Impuesto | null {
  return impuestos?.find((impuesto) => impuesto.tipo === "ninguno") ?? null;
}

export function impuestoPorId(
  impuestos: readonly Impuesto[] | null | undefined,
  id: string | null | undefined,
): Impuesto | null {
  if (!id) return null;
  return impuestos?.find((impuesto) => impuesto.id === id) ?? null;
}

export function impuestoPorTasa(
  impuestos: readonly Impuesto[] | null | undefined,
  tarifa: number,
  tipo: TipoImpuesto = "itbis",
): Impuesto | null {
  const redondeada = Math.round(tarifa * 100) / 100;
  return (
    impuestos?.find(
      (impuesto) => impuesto.activo && impuesto.tipo === tipo && Math.round(impuesto.tarifa * 100) / 100 === redondeada,
    ) ?? null
  );
}

export function resolverTarifa(
  impuestos: readonly Impuesto[] | null | undefined,
  impuestoId: string | null | undefined,
  tarifaRespaldo = 0,
): number {
  return impuestoPorId(impuestos, impuestoId)?.tarifa ?? tarifaRespaldo;
}

export function nombreImpuestoLinea(
  linea: { impuesto_id?: string | null; itbis_tasa: number },
  impuestos: readonly Impuesto[] | null | undefined,
): string {
  const impuesto = impuestoPorId(impuestos, linea.impuesto_id);
  if (impuesto) return etiquetaImpuesto(impuesto);
  if (linea.itbis_tasa === 0) return "ITBIS 0% (0.00%)";
  return `ITBIS (${linea.itbis_tasa.toFixed(2)}%)`;
}

export interface ResumenImpuestoLinea {
  clave: string;
  nombre: string;
  tarifa: number;
  total: number;
}

export function resumenImpuestos(
  lineas: readonly { impuesto_id?: string | null; itbis_tasa: number; itbis: number }[],
  impuestos: readonly Impuesto[] | null | undefined,
): ResumenImpuestoLinea[] {
  const grupos = new Map<string, ResumenImpuestoLinea>();

  for (const linea of lineas) {
    if (linea.itbis <= 0) continue;
    const impuesto = impuestoPorId(impuestos, linea.impuesto_id);
    const clave = impuesto?.id ?? `tasa-${linea.itbis_tasa}`;
    const actual = grupos.get(clave);
    if (actual) {
      actual.total += linea.itbis;
      continue;
    }
    grupos.set(clave, {
      clave,
      nombre: impuesto ? etiquetaImpuesto(impuesto) : nombreImpuestoLinea(linea, impuestos),
      tarifa: impuesto?.tarifa ?? linea.itbis_tasa,
      total: linea.itbis,
    });
  }

  return [...grupos.values()].sort((a, b) => b.tarifa - a.tarifa);
}
