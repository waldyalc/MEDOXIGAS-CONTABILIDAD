import type { TablaReporte } from "@/lib/reportes/exportar/tipos";

import { resumirPorTasa } from "./impuestos";
import type { DetalleImpuesto } from "./tipos";

export type VistaRetencion = "ventas" | "compras";

export interface FilaRetencion {
  nombre: string;
  tipo: string;
  tarifa: number | null;
  baseGravable: number;
  impuestos: number;
  baseDevoluciones: number;
  impuestosDevoluciones: number;
  saldo: number;
}

export function filasRetenciones(
  detalles: readonly DetalleImpuesto[],
  devoluciones: readonly DetalleImpuesto[],
  vista: VistaRetencion,
): FilaRetencion[] {
  const resumen = resumirPorTasa(detalles);
  const devolucion = resumirPorTasa(devoluciones);
  const tipo = vista === "ventas" ? "ITBIS" : "ITBIS Acreditable";

  return resumen.filas.map((fila, indice) => {
    const devuelta = devolucion.filas[indice] ?? { base: 0, impuesto: 0 };

    return {
      nombre: "ITBIS",
      tipo,
      tarifa: fila.tasa,
      baseGravable: fila.base,
      impuestos: fila.impuesto,
      baseDevoluciones: devuelta.base,
      impuestosDevoluciones: devuelta.impuesto,
      saldo: fila.impuesto - devuelta.impuesto,
    };
  });
}

export function tablaRetenciones(filas: readonly FilaRetencion[], titulo: string, subtitulo: string): TablaReporte {
  const totales = filas.reduce(
    (total, fila) => ({
      baseGravable: total.baseGravable + fila.baseGravable,
      impuestos: total.impuestos + fila.impuestos,
      baseDevoluciones: total.baseDevoluciones + fila.baseDevoluciones,
      impuestosDevoluciones: total.impuestosDevoluciones + fila.impuestosDevoluciones,
      saldo: total.saldo + fila.saldo,
    }),
    { baseGravable: 0, impuestos: 0, baseDevoluciones: 0, impuestosDevoluciones: 0, saldo: 0 },
  );

  return {
    titulo,
    subtitulo,
    columnas: [
      { clave: "nombre", titulo: "Nombre", tipo: "texto" },
      { clave: "tipo", titulo: "Tipo", tipo: "texto" },
      { clave: "tarifa", titulo: "Tarifa", tipo: "texto" },
      { clave: "baseGravable", titulo: "Base gravable", tipo: "dinero" },
      { clave: "impuestos", titulo: "Impuestos", tipo: "dinero" },
      { clave: "baseDevoluciones", titulo: "Base devoluciones", tipo: "dinero" },
      { clave: "impuestosDevoluciones", titulo: "Impuestos en devoluciones", tipo: "dinero" },
      { clave: "saldo", titulo: "Saldo", tipo: "dinero" },
    ],
    filas: [
      ...filas.map((fila) => ({
        celdas: {
          nombre: fila.nombre,
          tipo: fila.tipo,
          tarifa: fila.tarifa == null ? "Exento" : `${fila.tarifa}%`,
          baseGravable: fila.baseGravable,
          impuestos: fila.impuestos,
          baseDevoluciones: fila.baseDevoluciones,
          impuestosDevoluciones: fila.impuestosDevoluciones,
          saldo: fila.saldo,
        },
      })),
      {
        celdas: {
          nombre: "Total",
          tipo: null,
          tarifa: null,
          ...totales,
        },
        estilo: "total",
      },
    ],
  };
}
