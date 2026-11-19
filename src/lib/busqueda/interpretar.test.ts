import { format, parse, subDays } from "date-fns";
import { describe, expect, test } from "vitest";

import {
  hoyEnRd,
  rangoAnioAnterior,
  rangoAyer,
  rangoEstaSemana,
  rangoEsteAnio,
  rangoEsteMes,
  rangoMesAnterior,
} from "@/lib/fechas/rangos";

import { interpretar } from "./interpretar";

/** Los meses sin año son del año en curso (§4.4), así que se calcula al vuelo. */
function anioEnCurso(): number {
  return Number(hoyEnRd().slice(0, 4));
}

describe("interpretar: identificadores exactos (confianza 1)", () => {
  test("reconoce un NCF de crédito fiscal", () => {
    expect(interpretar("B0100000123")).toEqual({ ncf: "B0100000123", confianza: 1 });
  });

  test("normaliza un NCF en minúsculas a mayúsculas", () => {
    expect(interpretar("b0100000123")).toEqual({ ncf: "B0100000123", confianza: 1 });
  });

  test("reconoce un NCF electrónico largo", () => {
    expect(interpretar("E3412345678901")).toEqual({ ncf: "E3412345678901", confianza: 1 });
  });

  test("ignora los espacios de más alrededor del NCF", () => {
    expect(interpretar("  B0100000123  ")).toEqual({ ncf: "B0100000123", confianza: 1 });
  });

  test("reconoce #número como número exacto de documento", () => {
    expect(interpretar("#1258")).toEqual({ numero: 1258, confianza: 1 });
  });

  test("un número pelado de hasta 6 dígitos también es número de documento", () => {
    expect(interpretar("66")).toEqual({ numero: 66, confianza: 1 });
  });

  test("reconoce un RNC de 9 dígitos", () => {
    expect(interpretar("101123456")).toEqual({ identificacion: "101123456", confianza: 1 });
  });

  test("reconoce una cédula de 11 dígitos", () => {
    expect(interpretar("00112345678")).toEqual({ identificacion: "00112345678", confianza: 1 });
  });

  test("reconoce una cédula con guiones y devuelve solo dígitos", () => {
    expect(interpretar("001-1234567-8")).toEqual({ identificacion: "00112345678", confianza: 1 });
  });

  test("un teléfono de 10 dígitos no se confunde con RNC ni cédula", () => {
    expect(interpretar("8095551234")).toEqual({ texto: "8095551234", confianza: 0.6 });
  });
});

describe("interpretar: señales dentro de una frase", () => {
  test("encuentra el NCF dentro de la frase y la entidad la pone la palabra", () => {
    expect(interpretar("factura B0100000123")).toEqual({ ncf: "B0100000123", entidad: "factura", confianza: 1 });
  });

  test("encuentra el #número dentro de la frase", () => {
    expect(interpretar("pago #66 de pedro")).toEqual({
      numero: 66,
      texto: "pedro",
      entidad: "pago_recibido",
      confianza: 1,
    });
  });

  test("encuentra el RNC dentro de la frase", () => {
    expect(interpretar("factura de 101123456")).toEqual({
      identificacion: "101123456",
      entidad: "factura",
      confianza: 1,
    });
  });
});

describe("interpretar: montos", () => {
  test("reconoce RD$ con prefijo suelto y separador de miles", () => {
    expect(interpretar("RD$ 4,500")).toEqual({ monto: 4500, confianza: 0.7 });
  });

  test("reconoce el prefijo pegado sin separador", () => {
    expect(interpretar("RD$4500")).toEqual({ monto: 4500, confianza: 0.7 });
  });

  test("reconoce el formato con punto de miles y coma decimal", () => {
    expect(interpretar("4.500,50")).toEqual({ monto: 4500.5, confianza: 0.7 });
  });

  test("reconoce el formato con coma de miles y punto decimal", () => {
    expect(interpretar("1,250.00")).toEqual({ monto: 1250, confianza: 0.7 });
  });

  test("saca el monto de la frase y deja el texto limpio", () => {
    expect(interpretar("pago de 4,500 a Pedro")).toEqual({
      texto: "pedro",
      entidad: "pago_recibido",
      monto: 4500,
      confianza: 0.8,
    });
  });

  test("un monto pelado de 4 dígitos dentro de la frase también vale", () => {
    expect(interpretar("pago de 4500 a Pedro")).toEqual({
      texto: "pedro",
      entidad: "pago_recibido",
      monto: 4500,
      confianza: 0.8,
    });
  });
});

describe("interpretar: meses y rangos de fechas", () => {
  test("un mes sin año es del año en curso", () => {
    const anio = anioEnCurso();
    expect(interpretar("octubre")).toEqual({ desde: `${anio}-10-01`, hasta: `${anio}-10-31`, confianza: 0.85 });
  });

  test("un mes con año explícito", () => {
    expect(interpretar("noviembre 2026")).toEqual({ desde: "2026-11-01", hasta: "2026-11-30", confianza: 0.85 });
  });

  test("un mes abreviado con año", () => {
    expect(interpretar("oct 2025")).toEqual({ desde: "2025-10-01", hasta: "2025-10-31", confianza: 0.85 });
  });

  test("un mes con «de» antes del año", () => {
    expect(interpretar("octubre de 2026")).toEqual({ desde: "2026-10-01", hasta: "2026-10-31", confianza: 0.85 });
  });

  test("un mes escrito como año-mes", () => {
    expect(interpretar("2026-10")).toEqual({ desde: "2026-10-01", hasta: "2026-10-31", confianza: 0.85 });
  });

  test("«el mes pasado» reutiliza los rangos de fechas del repo", () => {
    const esperado = rangoMesAnterior(hoyEnRd());
    expect(interpretar("el mes pasado")).toEqual({ desde: esperado.desde, hasta: esperado.hasta, confianza: 0.85 });
  });

  test("«esta semana» va de lunes a domingo", () => {
    const esperado = rangoEstaSemana(hoyEnRd());
    expect(interpretar("esta semana")).toEqual({ desde: esperado.desde, hasta: esperado.hasta, confianza: 0.85 });
  });

  test("«este mes» es el mes en curso", () => {
    const esperado = rangoEsteMes(hoyEnRd());
    expect(interpretar("este mes")).toEqual({ desde: esperado.desde, hasta: esperado.hasta, confianza: 0.85 });
  });

  test("«ayer» es solo el día anterior", () => {
    const esperado = rangoAyer(hoyEnRd());
    expect(interpretar("ayer")).toEqual({ desde: esperado.desde, hasta: esperado.hasta, confianza: 0.85 });
  });

  test("«este año» es el año en curso", () => {
    const esperado = rangoEsteAnio(hoyEnRd());
    expect(interpretar("este año")).toEqual({ desde: esperado.desde, hasta: esperado.hasta, confianza: 0.85 });
  });

  test("«el año pasado» reutiliza el rango del repo", () => {
    const esperado = rangoAnioAnterior(hoyEnRd());
    expect(interpretar("el año pasado")).toEqual({ desde: esperado.desde, hasta: esperado.hasta, confianza: 0.85 });
  });

  test("«octubre del año pasado» cae en el octubre anterior", () => {
    const anterior = anioEnCurso() - 1;
    expect(interpretar("octubre del año pasado")).toEqual({
      desde: `${anterior}-10-01`,
      hasta: `${anterior}-10-31`,
      confianza: 0.85,
    });
  });

  test("«compras de la semana pasada» junta entidad y rango", () => {
    const hoy = hoyEnRd();
    const haceUnaSemana = format(subDays(parse(hoy, "yyyy-MM-dd", new Date()), 7), "yyyy-MM-dd");
    const esperado = rangoEstaSemana(haceUnaSemana);

    expect(interpretar("compras de la semana pasada")).toEqual({
      entidad: "factura_proveedor",
      desde: esperado.desde,
      hasta: esperado.hasta,
      confianza: 0.85,
    });
  });
});

describe("interpretar: entidades por palabras clave", () => {
  test("una palabra sola de entidad no arma texto", () => {
    expect(interpretar("facturas")).toEqual({ entidad: "factura", confianza: 0.5 });
  });

  test("«pagos a proveedores» es pago a proveedor, no contacto", () => {
    expect(interpretar("pagos a proveedores")).toEqual({ entidad: "pago_proveedor", confianza: 0.5 });
  });

  test("«nota de crédito» sin más contexto es nota de crédito de venta", () => {
    expect(interpretar("nota de credito")).toEqual({ entidad: "nota_credito_venta", confianza: 0.5 });
  });

  test("«nota de crédito de la compra» distingue la de compra", () => {
    expect(interpretar("nota de credito de la compra")).toEqual({ entidad: "nota_credito_compra", confianza: 0.5 });
  });

  test("«cliente» apunta a contactos y el nombre queda como texto", () => {
    expect(interpretar("cliente Ferretería Prueba")).toEqual({
      texto: "ferretería prueba",
      entidad: "contacto",
      confianza: 0.6,
    });
  });
});

describe("interpretar: texto, stopwords y frases largas", () => {
  test("la frase larga del documento queda resuelta como la intención 4.3", () => {
    const anio = anioEnCurso();
    expect(interpretar("factura de Pedro, creo que fue en octubre")).toEqual({
      texto: "pedro",
      entidad: "factura",
      desde: `${anio}-10-01`,
      hasta: `${anio}-10-31`,
      confianza: 0.9,
    });
  });

  test("«lo de Peña» deja el nombre con su acento en minúsculas", () => {
    expect(interpretar("lo de Peña")).toEqual({ texto: "peña", confianza: 0.6 });
  });

  test("los acentos del texto se conservan para que el SQL busque con unaccent", () => {
    expect(interpretar("compras de oxígeno")).toEqual({
      texto: "oxígeno",
      entidad: "factura_proveedor",
      confianza: 0.6,
    });
  });

  test("solo stopwords no alcanza para buscar nada", () => {
    expect(interpretar("de la que fue")).toEqual({ confianza: 0.3 });
  });

  test("el término vacío tampoco se entiende", () => {
    expect(interpretar("")).toEqual({ confianza: 0.3 });
    expect(interpretar("   ")).toEqual({ confianza: 0.3 });
  });
});
