import type { TablaReporte } from "@/lib/reportes/exportar/tipos";
import type { TipoRetencion } from "@/lib/retenciones/calculo";

export interface RetencionProveedor {
  id: string;
  contactoId: string;
  proveedor: string;
  rnc: string | null;
  tipo: TipoRetencion;
  nombre: string;
  base: number;
  monto: number;
  fecha: string;
  facturaNumero: number;
  facturaNcf: string | null;
}

export interface TotalTipoRetencion {
  tipo: TipoRetencion;
  base: number;
  monto: number;
}

export function resumirIr17(filas: readonly RetencionProveedor[]): TotalTipoRetencion[] {
  return (["itbis", "isr"] as const).map((tipo) => {
    const delTipo = filas.filter((fila) => fila.tipo === tipo);
    return {
      tipo,
      base: delTipo.reduce((total, fila) => total + fila.base, 0),
      monto: delTipo.reduce((total, fila) => total + fila.monto, 0),
    };
  });
}

export function tablaIr17(filas: readonly RetencionProveedor[], titulo: string, subtitulo: string): TablaReporte {
  const totalBase = filas.reduce((total, fila) => total + fila.base, 0);
  const totalMonto = filas.reduce((total, fila) => total + fila.monto, 0);

  return {
    titulo,
    subtitulo,
    columnas: [
      { clave: "rnc", titulo: "RNC/Cédula", tipo: "texto" },
      { clave: "proveedor", titulo: "Proveedor", tipo: "texto" },
      { clave: "documento", titulo: "Documento", tipo: "texto" },
      { clave: "fecha", titulo: "Fecha", tipo: "fecha" },
      { clave: "tipo", titulo: "Tipo", tipo: "texto" },
      { clave: "nombre", titulo: "Retención", tipo: "texto" },
      { clave: "base", titulo: "Base", tipo: "dinero" },
      { clave: "monto", titulo: "Retenido", tipo: "dinero" },
    ],
    filas: [
      ...filas.map((fila) => ({
        celdas: {
          rnc: fila.rnc ?? "—",
          proveedor: fila.proveedor,
          documento: fila.facturaNcf ?? `#${fila.facturaNumero}`,
          fecha: fila.fecha,
          tipo: fila.tipo === "itbis" ? "ITBIS" : "ISR",
          nombre: fila.nombre,
          base: fila.base / 100,
          monto: fila.monto / 100,
        },
      })),
      {
        celdas: {
          rnc: null,
          proveedor: "Total",
          documento: null,
          fecha: null,
          tipo: null,
          nombre: null,
          base: totalBase / 100,
          monto: totalMonto / 100,
        },
        estilo: "total",
      },
    ],
  };
}

export interface CartaProveedor {
  contactoId: string;
  proveedor: string;
  rnc: string | null;
  filas: RetencionProveedor[];
  totalBase: number;
  totalMonto: number;
  totalItbis: number;
  totalIsr: number;
}

export function agruparCartas(filas: readonly RetencionProveedor[]): CartaProveedor[] {
  const porProveedor = new Map<string, CartaProveedor>();

  for (const fila of filas) {
    const carta = porProveedor.get(fila.contactoId) ?? {
      contactoId: fila.contactoId,
      proveedor: fila.proveedor,
      rnc: fila.rnc,
      filas: [],
      totalBase: 0,
      totalMonto: 0,
      totalItbis: 0,
      totalIsr: 0,
    };

    carta.filas.push(fila);
    carta.totalBase += fila.base;
    carta.totalMonto += fila.monto;
    if (fila.tipo === "itbis") carta.totalItbis += fila.monto;
    else carta.totalIsr += fila.monto;
    porProveedor.set(fila.contactoId, carta);
  }

  return [...porProveedor.values()].sort((a, b) => a.proveedor.localeCompare(b.proveedor, "es"));
}
