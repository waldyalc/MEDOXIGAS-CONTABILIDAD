import { describe, expect, test } from "vitest";

import {
  ALMACEN_PRINCIPAL,
  agruparSerie,
  calcularTotales,
  calcularVentas,
  crearTablaVentasAlmacen,
  crearTablaVentasGenerales,
  etiquetaEstado,
  filtrarVentas,
  paginar,
} from "./calculos";
import type { FacturaVenta, FiltrosVentas } from "./tipos";

const CLIENTES = {
  c1: "Constructora Prueba SRL",
  c2: "Cliente Prueba",
};

const SIN_FILTROS: FiltrosVentas = { tipoComprobante: "", busqueda: "" };

function factura(parcial: Partial<FacturaVenta> = {}): FacturaVenta {
  return {
    id: "f1",
    numero: 1,
    ncf: null,
    tipo_comprobante: "B01",
    contacto_id: "c1",
    fecha: "2026-11-13",
    subtotal: 0,
    descuento: 0,
    itbis: 0,
    total: 0,
    pagado: 0,
    estado: "abierta",
    ...parcial,
  };
}

function facturasBase(): FacturaVenta[] {
  return [
    factura({
      id: "f1",
      numero: 1,
      ncf: "B0100000001",
      tipo_comprobante: "B01",
      contacto_id: "c1",
      subtotal: 14100,
      descuento: 0,
      itbis: 2538,
      total: 16638,
      estado: "abierta",
    }),
    factura({
      id: "f2",
      numero: 2,
      ncf: "B0200000001",
      tipo_comprobante: "B02",
      contacto_id: "c2",
      subtotal: 4400,
      descuento: 0,
      itbis: 792,
      total: 5192,
      estado: "pagada",
    }),
  ];
}

function facturaAnulada(): FacturaVenta {
  return factura({
    id: "f3",
    numero: 3,
    ncf: "B0100000003",
    subtotal: 1000,
    descuento: 0,
    itbis: 180,
    total: 1180,
    estado: "anulada",
  });
}

describe("cálculos de ventas", () => {
  test("suma los totales excluyendo anuladas y etiqueta los estados", () => {
    const ventas = calcularVentas(facturasBase(), CLIENTES);

    expect(calcularTotales(ventas)).toEqual({
      ventasBrutas: 1850000,
      notasCredito: 0,
      antesImpuestos: 1850000,
      impuestos: 333000,
      despuesImpuestos: 2183000,
    });
    expect(ventas.map((venta) => venta.estadoEtiqueta)).toEqual(["Por cobrar", "Cobrada"]);
    expect(etiquetaEstado("anulada")).toBe("Anulada");
    expect(etiquetaEstado("otro")).toBe("Por cobrar");
  });

  test("convierte los montos a centavos con el criterio de Alegra", () => {
    const ventas = calcularVentas(
      [
        factura({
          numero: 7,
          ncf: null,
          subtotal: 100,
          descuento: 10,
          itbis: 16.2,
          total: 106.2,
        }),
      ],
      CLIENTES,
    );

    expect(ventas[0]).toMatchObject({
      ncf: "#7",
      clienteNombre: "Constructora Prueba SRL",
      subtotal: 11000,
      descuento: 1000,
      antesImpuestos: 10000,
      impuestos: 1620,
      despuesImpuestos: 10620,
    });
  });

  test("usa un guion cuando el cliente no existe", () => {
    const ventas = calcularVentas([factura({ contacto_id: "desconocido" })], CLIENTES);

    expect(ventas[0]?.clienteNombre).toBe("—");
  });

  test("la factura anulada no altera los totales pero sí aparece en la tabla", () => {
    const ventas = calcularVentas([...facturasBase(), facturaAnulada()], CLIENTES);

    expect(calcularTotales(ventas)).toEqual({
      ventasBrutas: 1850000,
      notasCredito: 0,
      antesImpuestos: 1850000,
      impuestos: 333000,
      despuesImpuestos: 2183000,
    });

    const tabla = crearTablaVentasGenerales(ventas, "Del 13/11/2026 al 13/11/2026");
    expect(tabla.filas).toHaveLength(4);
    expect(tabla.filas[0]?.celdas.documento).toBe("B0100000001");
    expect(tabla.filas.find((fila) => fila.celdas.documento === "B0100000003")?.celdas.estado).toBe("Anulada");
  });

  test("filtra por tipo de comprobante y por búsqueda sin acentos", () => {
    const ventas = calcularVentas(facturasBase(), CLIENTES);

    expect(filtrarVentas(ventas, { tipoComprobante: "B01", busqueda: "" }).map((venta) => venta.ncf)).toEqual([
      "B0100000001",
    ]);
    expect(filtrarVentas(ventas, { tipoComprobante: "", busqueda: "constructora" })).toHaveLength(1);
    expect(filtrarVentas(ventas, { tipoComprobante: "", busqueda: "B0200" })).toHaveLength(1);
    expect(filtrarVentas(ventas, { tipoComprobante: "", busqueda: "PRUEBA" })).toHaveLength(2);
    expect(filtrarVentas(ventas, SIN_FILTROS)).toHaveLength(2);

    const acentuadas = calcularVentas([factura({ contacto_id: "c3", ncf: "B0100000009" })], {
      c3: "Compañía Eléctrica SRL",
    });

    expect(filtrarVentas(acentuadas, { tipoComprobante: "", busqueda: "compania electrica" })).toHaveLength(1);
  });

  test("agrupa la serie diaria y mensual sin anuladas", () => {
    const ventas = calcularVentas([...facturasBase(), facturaAnulada()], CLIENTES);

    expect(agruparSerie(ventas, "diario")).toEqual([{ clave: "2026-11-13", etiqueta: "13/11", total: 2183000 }]);
    expect(agruparSerie(ventas, "mensual")).toEqual([{ clave: "2026-11", etiqueta: "nov 2026", total: 2183000 }]);
  });

  test("pagina los resultados y limita la página solicitada", () => {
    const facturas = Array.from({ length: 12 }, (_, indice) =>
      factura({ id: `f${indice}`, numero: indice + 1, ncf: `B01000000${indice}` }),
    );
    const ventas = calcularVentas(facturas, CLIENTES);

    const primera = paginar(ventas, 1);
    expect(primera.filas).toHaveLength(10);
    expect(primera.totalFilas).toBe(12);
    expect(primera.totalPaginas).toBe(2);
    expect(primera.pagina).toBe(1);

    const segunda = paginar(ventas, 2);
    expect(segunda.filas).toHaveLength(2);
    expect(segunda.pagina).toBe(2);

    const fueraDeRango = paginar(ventas, 99);
    expect(fueraDeRango.pagina).toBe(2);
    expect(fueraDeRango.filas).toHaveLength(2);
  });

  test("crea la tabla de ventas generales con columnas, subtítulo y fila total", () => {
    const ventas = calcularVentas([...facturasBase(), facturaAnulada()], CLIENTES);
    const tabla = crearTablaVentasGenerales(ventas, "Del 13/11/2026 al 13/11/2026");

    expect(tabla.titulo).toBe("Ventas generales");
    expect(tabla.subtitulo).toBe("Del 13/11/2026 al 13/11/2026");
    expect(tabla.columnas.map((columna) => columna.clave)).toEqual([
      "documento",
      "cliente",
      "estado",
      "fecha",
      "subtotal",
      "descuento",
      "antesImpuestos",
      "impuestos",
      "despuesImpuestos",
    ]);
    expect(tabla.columnas.map((columna) => columna.titulo)).toEqual([
      "Documento",
      "Cliente",
      "Estado",
      "Creación",
      "Subtotal",
      "Descuento",
      "Antes de impuestos",
      "Impuestos",
      "Después de impuestos",
    ]);
    expect(tabla.filas[0]?.celdas).toMatchObject({
      documento: "B0100000001",
      cliente: "Constructora Prueba SRL",
      estado: "Por cobrar",
      fecha: "2026-11-13",
      subtotal: 1410000,
      impuestos: 253800,
      despuesImpuestos: 1663800,
    });

    const total = tabla.filas.at(-1);
    if (total == null) throw new Error("La tabla debe incluir la fila total");

    expect(total.estilo).toBe("total");
    expect(total.celdas).toMatchObject({
      documento: "Total",
      cliente: null,
      estado: null,
      fecha: null,
      subtotal: 1850000,
      descuento: 0,
      antesImpuestos: 1850000,
      impuestos: 333000,
      despuesImpuestos: 2183000,
    });
  });

  test("crea la tabla por almacén con sus columnas y el centro de costos vacío", () => {
    const ventas = calcularVentas(facturasBase(), CLIENTES);
    const tabla = crearTablaVentasAlmacen(ventas, "Del 13/11/2026 al 13/11/2026");

    expect(tabla.titulo).toBe("Ventas por almacén");
    expect(tabla.columnas.map((columna) => columna.clave)).toEqual([
      "documento",
      "cliente",
      "estado",
      "fecha",
      "almacen",
      "centroCostos",
      "subtotal",
      "descuento",
      "antesImpuestos",
      "impuestos",
      "despuesImpuestos",
    ]);
    expect(tabla.filas[0]?.celdas.almacen).toBe(ALMACEN_PRINCIPAL);
    expect(tabla.filas[0]?.celdas.centroCostos).toBeNull();

    const total = tabla.filas.at(-1);
    if (total == null) throw new Error("La tabla debe incluir la fila total");

    expect(total.estilo).toBe("total");
    expect(total.celdas).toMatchObject({
      documento: "Total",
      almacen: null,
      centroCostos: null,
      antesImpuestos: 1850000,
      impuestos: 333000,
      despuesImpuestos: 2183000,
    });
  });
});
