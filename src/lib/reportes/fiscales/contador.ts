import { centavos } from "@/lib/reportes/dinero";
import type { TablaReporte } from "@/lib/reportes/exportar/tipos";
import { etiquetaOrigen } from "@/lib/reportes/libro-diario";
import type { FilaLibroDiario } from "@/lib/reportes/tipos";

import type { DocumentoFiscal } from "./tipos";

function total(documentos: readonly DocumentoFiscal[], campo: "base" | "itbis" | "total"): number {
  return documentos.reduce((suma, documento) => suma + documento[campo], 0);
}

export function tablaFacturasContador(documentos: readonly DocumentoFiscal[], subtitulo: string): TablaReporte {
  return {
    titulo: "Facturas de venta",
    subtitulo,
    columnas: [
      { clave: "ncf", titulo: "NCF", tipo: "texto" },
      { clave: "fecha", titulo: "Fecha", tipo: "fecha" },
      { clave: "cliente", titulo: "Cliente", tipo: "texto" },
      { clave: "rnc", titulo: "RNC/Cédula", tipo: "texto" },
      { clave: "subtotal", titulo: "Subtotal", tipo: "dinero" },
      { clave: "itbis", titulo: "ITBIS", tipo: "dinero" },
      { clave: "total", titulo: "Total", tipo: "dinero" },
      { clave: "estado", titulo: "Estado", tipo: "texto" },
    ],
    filas: [
      ...documentos.map((documento) => ({
        celdas: {
          ncf: documento.ncf,
          fecha: documento.fecha,
          cliente: documento.contactoNombre,
          rnc: documento.rnc ?? "",
          subtotal: documento.base,
          itbis: documento.itbis,
          total: documento.total,
          estado: documento.estado,
        },
      })),
      {
        celdas: {
          ncf: "Total",
          fecha: null,
          cliente: null,
          rnc: null,
          subtotal: total(documentos, "base"),
          itbis: total(documentos, "itbis"),
          total: total(documentos, "total"),
          estado: null,
        },
        estilo: "total",
      },
    ],
  };
}

export function tablaComprasContador(documentos: readonly DocumentoFiscal[], subtitulo: string): TablaReporte {
  return {
    titulo: "Compras",
    subtitulo,
    columnas: [
      { clave: "ncf", titulo: "NCF/Número", tipo: "texto" },
      { clave: "fecha", titulo: "Fecha", tipo: "fecha" },
      { clave: "proveedor", titulo: "Proveedor", tipo: "texto" },
      { clave: "rnc", titulo: "RNC/Cédula", tipo: "texto" },
      { clave: "subtotal", titulo: "Subtotal", tipo: "dinero" },
      { clave: "itbis", titulo: "ITBIS", tipo: "dinero" },
      { clave: "total", titulo: "Total", tipo: "dinero" },
      { clave: "estado", titulo: "Estado", tipo: "texto" },
    ],
    filas: [
      ...documentos.map((documento) => ({
        celdas: {
          ncf: documento.ncf || `#${documento.numero}`,
          fecha: documento.fecha,
          proveedor: documento.contactoNombre,
          rnc: documento.rnc ?? "",
          subtotal: documento.base,
          itbis: documento.itbis,
          total: documento.total,
          estado: documento.estado,
        },
      })),
      {
        celdas: {
          ncf: "Total",
          fecha: null,
          proveedor: null,
          rnc: null,
          subtotal: total(documentos, "base"),
          itbis: total(documentos, "itbis"),
          total: total(documentos, "total"),
          estado: null,
        },
        estilo: "total",
      },
    ],
  };
}

export function tablaLibroContador(filas: readonly FilaLibroDiario[], subtitulo: string): TablaReporte {
  let debitos = 0;
  let creditos = 0;

  const cuerpo = filas.map((fila) => {
    const debito = centavos(fila.debito);
    const credito = centavos(fila.credito);
    debitos += debito;
    creditos += credito;

    return {
      celdas: {
        asiento: fila.asiento_numero,
        fecha: fila.fecha,
        descripcion: fila.asiento_descripcion ?? "",
        origen: etiquetaOrigen(fila.origen_tipo),
        codigo: fila.cuenta_codigo,
        cuenta: fila.cuenta_nombre,
        debito,
        credito,
      },
    };
  });

  return {
    titulo: "Libro diario",
    subtitulo,
    columnas: [
      { clave: "asiento", titulo: "Asiento", tipo: "texto" },
      { clave: "fecha", titulo: "Fecha", tipo: "fecha" },
      { clave: "descripcion", titulo: "Descripción", tipo: "texto" },
      { clave: "origen", titulo: "Origen", tipo: "texto" },
      { clave: "codigo", titulo: "Código", tipo: "texto" },
      { clave: "cuenta", titulo: "Cuenta", tipo: "texto" },
      { clave: "debito", titulo: "Débito", tipo: "dinero" },
      { clave: "credito", titulo: "Crédito", tipo: "dinero" },
    ],
    filas: [
      ...cuerpo,
      {
        celdas: {
          asiento: "Total",
          fecha: null,
          descripcion: null,
          origen: null,
          codigo: null,
          cuenta: null,
          debito: debitos,
          credito: creditos,
        },
        estilo: "total",
      },
    ],
  };
}
