import { describe, expect, test } from "vitest";

import {
  agruparImpuestos,
  etiquetaImpuesto,
  type Impuesto,
  impuestoNinguno,
  impuestoPorTasa,
  nombreImpuestoLinea,
  resolverTarifa,
  resumenImpuestos,
} from "./tipos";

const IMPUESTOS: Impuesto[] = [
  {
    id: "n",
    codigo: "ninguno",
    nombre: "Ninguno",
    tipo: "ninguno",
    tarifa: 0,
    cuenta_id: null,
    activo: true,
    orden: 0,
  },
  {
    id: "i18",
    codigo: "itbis-18",
    nombre: "ITBIS",
    tipo: "itbis",
    tarifa: 18,
    cuenta_id: "2102",
    activo: true,
    orden: 10,
  },
  {
    id: "i16",
    codigo: "itbis-16",
    nombre: "ITBIS 16%",
    tipo: "itbis",
    tarifa: 16,
    cuenta_id: "2102",
    activo: true,
    orden: 11,
  },
  {
    id: "i0",
    codigo: "itbis-0",
    nombre: "ITBIS 0%",
    tipo: "itbis",
    tarifa: 0,
    cuenta_id: "2102",
    activo: true,
    orden: 12,
  },
  { id: "c", codigo: "cdt", nombre: "CDT", tipo: "otro", tarifa: 2, cuenta_id: "2105", activo: true, orden: 20 },
  {
    id: "p",
    codigo: "propina",
    nombre: "Propina",
    tipo: "propina",
    tarifa: 10,
    cuenta_id: "2106",
    activo: true,
    orden: 30,
  },
  { id: "e", codigo: "exento", nombre: "Exento", tipo: "exento", tarifa: 0, cuenta_id: null, activo: true, orden: 40 },
];

describe("catálogo de impuestos", () => {
  test("etiqueta nombre y tarifa con dos decimales", () => {
    expect(etiquetaImpuesto(IMPUESTOS[1] as Impuesto)).toBe("ITBIS (18.00%)");
    expect(etiquetaImpuesto(IMPUESTOS[2] as Impuesto)).toBe("ITBIS 16% (16.00%)");
    expect(etiquetaImpuesto(IMPUESTOS[5] as Impuesto)).toBe("Propina (10.00%)");
    expect(etiquetaImpuesto(IMPUESTOS[0] as Impuesto)).toBe("Ninguno");
  });

  test("agrupa en el orden de Alegra y deja Ninguno aparte", () => {
    const grupos = agruparImpuestos(IMPUESTOS);
    expect(grupos.map((grupo) => grupo.etiqueta)).toEqual(["ITBIS", "Otro", "Propina legal", "Exento (E)"]);
    expect(grupos[0]?.impuestos.map((impuesto) => impuesto.codigo)).toEqual(["itbis-18", "itbis-16", "itbis-0"]);
  });

  test("encuentra Ninguno, por id y por tasa", () => {
    expect(impuestoNinguno(IMPUESTOS)?.codigo).toBe("ninguno");
    expect(impuestoPorTasa(IMPUESTOS, 16)?.codigo).toBe("itbis-16");
    expect(impuestoPorTasa(IMPUESTOS, 2, "otro")?.codigo).toBe("cdt");
    expect(resolverTarifa(IMPUESTOS, "p", 0)).toBe(10);
  });

  test("nombra la línea vieja por su tarifa", () => {
    expect(nombreImpuestoLinea({ impuesto_id: null, itbis_tasa: 18 }, IMPUESTOS)).toBe("ITBIS (18.00%)");
    expect(nombreImpuestoLinea({ impuesto_id: "e", itbis_tasa: 0 }, IMPUESTOS)).toBe("Exento (0.00%)");
    expect(nombreImpuestoLinea({ impuesto_id: null, itbis_tasa: 0 }, IMPUESTOS)).toBe("ITBIS 0% (0.00%)");
  });

  test("resume solo impuestos con monto y suma por impuesto", () => {
    const resumen = resumenImpuestos(
      [
        { impuesto_id: "i18", itbis_tasa: 18, itbis: 18 },
        { impuesto_id: "i18", itbis_tasa: 18, itbis: 9 },
        { impuesto_id: "c", itbis_tasa: 2, itbis: 2 },
        { impuesto_id: "e", itbis_tasa: 0, itbis: 0 },
      ],
      IMPUESTOS,
    );

    expect(resumen.map((fila) => [fila.nombre, fila.total])).toEqual([
      ["ITBIS (18.00%)", 27],
      ["CDT (2.00%)", 2],
    ]);
  });
});
