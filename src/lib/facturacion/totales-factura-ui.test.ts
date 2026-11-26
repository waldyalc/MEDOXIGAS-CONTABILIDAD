import { describe, expect, test } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";

const RUTA_VISTA = join(process.cwd(), "src", "components", "documento-venta", "vista-documento-venta.tsx");
const RUTA_PAPEL_FACTURA = join(process.cwd(), "src", "components", "documento-venta", "documento-papel.tsx");
const RUTA_NC_FORM = join(
  process.cwd(),
  "src",
  "app",
  "(main)",
  "dashboard",
  "notas-credito",
  "nueva",
  "_components",
  "nota-credito-form.tsx",
);
const RUTA_NC_PAPEL = join(process.cwd(), "src", "components", "impresion", "nota-credito-papel.tsx");
const RUTA_ND_PAPEL = join(process.cwd(), "src", "components", "impresion", "nota-debito-papel.tsx");
const RUTA_NC_CONSULTAS = join(process.cwd(), "src", "lib", "notas-credito", "consultas.ts");
const RUTA_ND_CONSULTAS = join(process.cwd(), "src", "lib", "notas-debito", "consultas.ts");
const RUTA_FACTURAS_TABLA = join(
  process.cwd(),
  "src",
  "app",
  "(main)",
  "dashboard",
  "facturacion",
  "_components",
  "facturas-tabla.tsx",
);

/**
 * Candados de los bugs 3, 4, 6, 7, 8 y 9 de la auditoría de facturación: la
 * vista y el papel muestran el Subtotal bruto cuando hay Descuento, las notas
 * B03/B04 incluyen otros impuestos y propina, no se anula con notas activas,
 * la fecha de anulación no es anterior a la factura, la conversión ofrece los
 * NCF B14/B15/B16 y la tabla de facturas compara con la fecha de RD.
 */

describe("Subtotal bruto junto a la fila Descuento (bug 3)", () => {
  test("la vista de la factura muestra subtotal + descuento y no el subtotal neto", () => {
    const vista = readFileSync(RUTA_VISTA, "utf8");

    expect(vista, "Subtotal debe ser subtotalBruto(subtotal, descuento) en TotalesDocumento").toContain(
      "formatoMoneda(subtotalBruto(subtotal, descuento))",
    );
  });

  test("el papel de la factura también muestra el Subtotal bruto", () => {
    const papel = readFileSync(RUTA_PAPEL_FACTURA, "utf8");

    expect(papel, "TotalesFactura debe sumar el descuento al subtotal guardado").toContain(
      "formatearMontoPapel(subtotalBruto(datos.subtotal, datos.descuento))",
    );
  });

  test("el formulario de nota de crédito muestra Descuento cuando hay descuento", () => {
    const formulario = readFileSync(RUTA_NC_FORM, "utf8");

    expect(formulario, "Renderiza la fila Descuento con totales.descuentoCentavos").toContain(
      "totales.descuentoCentavos > 0",
    );
    expect(formulario, "Muestra el monto del descuento en la fila").toContain(
      "formatoMonedaCentavos(totales.descuentoCentavos)",
    );
  });
});

describe("otros impuestos (CDT 2 %) y propina (10 %) en las notas (bug 4)", () => {
  test("las consultas de la nota de crédito y de débito piden otros_impuestos y propina", () => {
    for (const [ruta, nombre] of [
      [RUTA_NC_CONSULTAS, "getNotaCreditoVista"],
      [RUTA_ND_CONSULTAS, "getNotaDebitoVista"],
    ] as const) {
      const consultas = readFileSync(ruta, "utf8");
      expect(consultas, `${nombre} debe seleccionar otros_impuestos`).toContain("otros_impuestos");
      expect(consultas, `${nombre} debe seleccionar propina`).toContain("propina");
    }
  });

  test("los papeles de la nota de crédito y de débito usan las filas de totales completas", () => {
    for (const [ruta, nombre] of [
      [RUTA_NC_PAPEL, "nota-credito-papel"],
      [RUTA_ND_PAPEL, "nota-debito-papel"],
    ] as const) {
      const papel = readFileSync(ruta, "utf8");
      expect(papel, `${nombre} debe imprimir filasTotalesNota(nota)`).toContain("filasTotalesNota(nota)");
    }
  });
});

describe("permisos de anulación y nota de crédito (bugs 1 y 7)", () => {
  const vista = readFileSync(RUTA_VISTA, "utf8");

  test("la vista pasa las notas activas y los pagos a permisosDeFactura", () => {
    expect(vista, "Anular se deshabilita cuando hay notas activas").toContain("tieneNotasActivas:");
    expect(vista, "La nota de crédito se limita con los pagos de la factura").toContain("tienePagos:");
    expect(vista, "Las notas activas se cuentan sin las anuladas").toContain(
      '.some((nota) => nota.estado !== "anulada")',
    );
  });
});

describe("fecha de anulación (bug 6)", () => {
  const vista = readFileSync(RUTA_VISTA, "utf8");

  test("el calendario no ofrece días anteriores a la factura y el envío lo vuelve a validar", () => {
    expect(vista, "El DatePicker de anulación lleva min con la fecha del documento").toContain("min={fechaDocumento}");
    expect(vista, "Valida fecha >= fecha de la factura antes de llamar a la RPC").toContain(
      "La fecha de anulación no puede ser anterior a la fecha de la factura.",
    );
  });
});

describe("conversión a factura con B14, B15 y B16 (bug 8)", () => {
  test("el diálogo de conversión ofrece los cinco tipos de comprobante", () => {
    const vista = readFileSync(RUTA_VISTA, "utf8");

    expect(vista, "La lista de comprobantes debe incluir los NCF 14, 15 y 16").toContain(
      'const COMPROBANTES = ["02", "01", "14", "15", "16"]',
    );
  });
});

describe("fecha de hoy de la tabla de facturas (bug 9)", () => {
  test("compara con la fecha de República Dominicana, no con UTC", () => {
    const tabla = readFileSync(RUTA_FACTURAS_TABLA, "utf8");

    expect(tabla, "Usa hoyRd() de @/lib/reportes/fechas").toContain("const hoy = hoyRd();");
    expect(tabla, "No vuelve a toISOString(), que en RD puede dar el día siguiente").not.toContain(
      "toISOString().slice(0, 10)",
    );
  });
});
