import type { FilaReporte, TablaReporte } from "@/lib/reportes/exportar/tipos";

import { totalCartera } from "./antiguedad";
import { totalesCompras } from "./compras";
import { totalInventario } from "./inventario";
import type { FilaCartera, FilaCompra, FilaInventario } from "./tipos";

function referencia(fila: FilaCartera): string {
  return fila.ncf ?? `#${fila.numero}`;
}

function sumar(filas: readonly FilaCartera[], clave: "total" | "pagado" | "saldo"): number {
  return filas.reduce((total, fila) => total + fila[clave], 0);
}

function filaTotalCartera(filas: readonly FilaCartera[]): FilaReporte {
  return {
    celdas: {
      total: sumar(filas, "total"),
      pagado: sumar(filas, "pagado"),
      saldo: totalCartera(filas),
    },
    estilo: "total",
  };
}

export function tablaCuentasPorCobrar(filas: readonly FilaCartera[], subtitulo: string): TablaReporte {
  const total = filaTotalCartera(filas);

  return {
    titulo: "Cuentas por cobrar",
    subtitulo,
    columnas: [
      { clave: "numero", titulo: "NCF/Número", tipo: "texto" },
      { clave: "tipo", titulo: "Tipo de documento", tipo: "texto" },
      { clave: "cliente", titulo: "Cliente", tipo: "texto" },
      { clave: "creacion", titulo: "Creación", tipo: "fecha" },
      { clave: "vencimiento", titulo: "Vencimiento", tipo: "fecha" },
      { clave: "total", titulo: "Total", tipo: "dinero" },
      { clave: "pagado", titulo: "Cobrado", tipo: "dinero" },
      { clave: "saldo", titulo: "Por cobrar", tipo: "dinero" },
    ],
    filas: [
      ...filas.map<FilaReporte>((fila) => ({
        celdas: {
          numero: referencia(fila),
          tipo: fila.tipoDocumento,
          cliente: fila.contactoNombre,
          creacion: fila.creado,
          vencimiento: fila.vencimiento,
          total: fila.total,
          pagado: fila.pagado,
          saldo: fila.saldo,
        },
      })),
      { ...total, celdas: { ...total.celdas, numero: "Total por cobrar" } },
    ],
  };
}

export function tablaCuentasPorPagar(filas: readonly FilaCartera[], subtitulo: string): TablaReporte {
  const total = filaTotalCartera(filas);

  return {
    titulo: "Cuentas por pagar",
    subtitulo,
    columnas: [
      { clave: "tipo", titulo: "Tipo de documento", tipo: "texto" },
      { clave: "numero", titulo: "NCF/Número", tipo: "texto" },
      { clave: "proveedor", titulo: "Proveedor", tipo: "texto" },
      { clave: "creacion", titulo: "Creación", tipo: "fecha" },
      { clave: "vencimiento", titulo: "Vencimiento", tipo: "fecha" },
      { clave: "total", titulo: "Total", tipo: "dinero" },
      { clave: "pagado", titulo: "Pagado", tipo: "dinero" },
      { clave: "saldo", titulo: "Por pagar", tipo: "dinero" },
    ],
    filas: [
      ...filas.map<FilaReporte>((fila) => ({
        celdas: {
          tipo: fila.tipoDocumento,
          numero: referencia(fila),
          proveedor: fila.contactoNombre,
          creacion: fila.creado,
          vencimiento: fila.vencimiento,
          total: fila.total,
          pagado: fila.pagado,
          saldo: fila.saldo,
        },
      })),
      { ...total, celdas: { ...total.celdas, tipo: "Total por pagar" } },
    ],
  };
}

export function tablaCompras(filas: readonly FilaCompra[], subtitulo: string): TablaReporte {
  const totales = totalesCompras(filas);

  return {
    titulo: "Compras",
    subtitulo,
    columnas: [
      { clave: "numero", titulo: "Número de factura", tipo: "texto" },
      { clave: "proveedor", titulo: "Proveedor", tipo: "texto" },
      { clave: "fecha", titulo: "Fecha", tipo: "fecha" },
      { clave: "subtotal", titulo: "Antes de impuestos", tipo: "dinero" },
      { clave: "total", titulo: "Después de impuestos", tipo: "dinero" },
    ],
    filas: [
      ...filas.map<FilaReporte>((fila) => ({
        celdas: {
          numero: fila.ncf ?? `#${fila.numero}`,
          proveedor: fila.contactoNombre,
          fecha: fila.fecha,
          subtotal: fila.subtotal,
          total: fila.total,
        },
      })),
      {
        celdas: {
          numero: "Total",
          proveedor: null,
          fecha: null,
          subtotal: totales.antesDeImpuestos,
          total: totales.despuesDeImpuestos,
        },
        estilo: "total",
      },
    ],
  };
}

export function tablaInventario(filas: readonly FilaInventario[], subtitulo: string): TablaReporte {
  return {
    titulo: "Valor de inventario",
    subtitulo,
    columnas: [
      { clave: "producto", titulo: "Producto/servicio", tipo: "texto" },
      { clave: "referencia", titulo: "Referencia", tipo: "texto" },
      { clave: "descripcion", titulo: "Descripción", tipo: "texto" },
      { clave: "cantidad", titulo: "Cantidad", tipo: "texto" },
      { clave: "unidad", titulo: "Unidad", tipo: "texto" },
      { clave: "estado", titulo: "Estado", tipo: "texto" },
      { clave: "costo", titulo: "Costo promedio", tipo: "dinero" },
      { clave: "total", titulo: "Total", tipo: "dinero" },
    ],
    filas: [
      ...filas.map<FilaReporte>((fila) => ({
        celdas: {
          producto: fila.nombre,
          referencia: fila.referencia,
          descripcion: fila.descripcion,
          cantidad: fila.cantidad,
          unidad: fila.unidad,
          estado: fila.activo ? "Activo" : "Inactivo",
          costo: fila.costo,
          total: fila.total,
        },
      })),
      {
        celdas: {
          producto: "Total general",
          referencia: null,
          descripcion: null,
          cantidad: null,
          unidad: null,
          estado: null,
          costo: null,
          total: totalInventario(filas),
        },
        estilo: "total",
      },
    ],
  };
}
