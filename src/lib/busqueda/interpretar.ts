/**
 * Parser determinista de la búsqueda global (docs/busqueda-global.md §4.3).
 *
 * Una sola función pura: `interpretar(termino)` devuelve la intención antes de
 * consultar la base. Sin IA, sin red y sin estado: las fechas relativas se
 * apoyan en `hoyEnRd()` (zona de República Dominicana).
 *
 * Precedencia de las señales (riesgo R4 del documento):
 *
 * 1. El término **completo** es un identificador exacto: NCF (`B0100000123`,
 *    letra + 2 dígitos + 8 o más alfanuméricos), número de documento con o sin
 *    `#` (1 a 6 dígitos, como `numeroDocumento` de las listas) o RNC/cédula de
 *    9 o 11 dígitos. Confianza 1.
 * 2. Dentro de una frase se reconozcan NCF, `#número`, RNC/cédula (con o sin
 *    guiones), montos (`RD$ 4,500`, `4.500,50`, `4500`), meses y rangos
 *    relativos («el mes pasado», «esta semana»), y palabras de entidad
 *    («factura», «compras», «nota de crédito»…). El resto, sin stopwords, es
 *    el `texto`.
 *
 * Montos pelados dentro de una frase: se toman como monto a partir de 4
 * dígitos («pago de 4500»); un pelado de 1 a 3 dígitos se queda en el texto y
 * uno de 9 u 11 ya se trató como RNC/cédula.
 */

import { endOfMonth, format, parse, subDays } from "date-fns";

import {
  hoyEnRd,
  type RangoFechas,
  rangoAnioAnterior,
  rangoAyer,
  rangoEstaSemana,
  rangoEsteAnio,
  rangoEsteMes,
  rangoEsteTrimestre,
  rangoHoy,
  rangoMesAnterior,
} from "@/lib/fechas/rangos";

import type { EntidadBusqueda, IntencionBusqueda } from "./tipos";

const FORMATO_ISO = "yyyy-MM-dd";

/** Meses y abreviaturas de tres letras, sin acentos (§4.3: «octubre», «oct 2025»). */
const MESES: Record<string, number> = {
  enero: 0,
  ene: 0,
  febrero: 1,
  feb: 1,
  marzo: 2,
  mar: 2,
  abril: 3,
  abr: 3,
  mayo: 4,
  may: 4,
  junio: 5,
  jun: 5,
  julio: 6,
  jul: 6,
  agosto: 7,
  ago: 7,
  septiembre: 8,
  setiembre: 8,
  sep: 8,
  set: 8,
  octubre: 9,
  oct: 9,
  noviembre: 10,
  nov: 10,
  diciembre: 11,
  dic: 11,
};

/** Stopwords en español (§4.3) más las palabras sueltas de los rangos. */
const STOPWORDS = new Set([
  "a",
  "al",
  "ano",
  "busca",
  "busco",
  "con",
  "creo",
  "de",
  "del",
  "el",
  "en",
  "es",
  "esta",
  "este",
  "esto",
  "fue",
  "la",
  "las",
  "lo",
  "los",
  "mes",
  "mi",
  "mis",
  "o",
  "para",
  "pasada",
  "pasado",
  "por",
  "que",
  "semana",
  "trimestre",
  "un",
  "una",
  "unas",
  "unos",
  "y",
]);

/** Palabra de entidad → concepto al que aporta (los plurales incluidos). */
const CONCEPTOS: Record<string, string> = {
  factura: "factura",
  facturas: "factura",
  facturacion: "factura",
  compra: "compra",
  compras: "compra",
  gasto: "gasto",
  gastos: "gasto",
  pago: "pago",
  pagos: "pago",
  proveedor: "proveedor",
  proveedores: "proveedor",
  cliente: "cliente",
  clientes: "cliente",
  contacto: "contacto",
  contactos: "contacto",
  producto: "producto",
  productos: "producto",
  servicio: "producto",
  servicios: "producto",
  nota: "nota",
  notas: "nota",
  credito: "credito",
  debito: "debito",
  cotizacion: "cotizacion",
  cotizaciones: "cotizacion",
  presupuesto: "cotizacion",
  presupuestos: "cotizacion",
  conduce: "remision",
  conduces: "remision",
  remision: "remision",
  remisiones: "remision",
  asiento: "asiento",
  asientos: "asiento",
  cuenta: "cuenta",
  cuentas: "cuenta",
  reporte: "reporte",
  reportes: "reporte",
  orden: "orden",
  ordenes: "orden",
  recurrente: "recurrente",
  recurrentes: "recurrente",
};

/**
 * Primera regla cuyos conceptos estén todos presentes gana. El orden resuelve
 * las frases compuestas: «nota de crédito de compra», «pago a proveedor»,
 * «factura recurrente», «factura de proveedor»…
 */
const REGLAS_ENTIDAD: readonly { requiere: readonly string[]; entidad: EntidadBusqueda }[] = [
  { requiere: ["nota", "credito", "compra"], entidad: "nota_credito_compra" },
  { requiere: ["nota", "credito"], entidad: "nota_credito_venta" },
  { requiere: ["nota", "debito"], entidad: "nota_debito_venta" },
  { requiere: ["orden"], entidad: "orden_compra" },
  { requiere: ["recurrente"], entidad: "factura_recurrente" },
  { requiere: ["pago", "proveedor"], entidad: "pago_proveedor" },
  { requiere: ["pago"], entidad: "pago_recibido" },
  { requiere: ["factura", "proveedor"], entidad: "factura_proveedor" },
  { requiere: ["factura"], entidad: "factura" },
  { requiere: ["compra"], entidad: "factura_proveedor" },
  { requiere: ["gasto"], entidad: "gasto_menor" },
  { requiere: ["cliente"], entidad: "contacto" },
  { requiere: ["proveedor"], entidad: "contacto" },
  { requiere: ["contacto"], entidad: "contacto" },
  { requiere: ["producto"], entidad: "producto" },
  { requiere: ["cotizacion"], entidad: "cotizacion" },
  { requiere: ["remision"], entidad: "remision" },
  { requiere: ["asiento"], entidad: "asiento" },
  { requiere: ["cuenta"], entidad: "cuenta" },
  { requiere: ["reporte"], entidad: "reporte" },
];

/** Prefijos de moneda pegados (`RD$4,500`) o sueltos (`RD$ 4,500`). */
const PREFIJOS_MONTO = new Set(["rd$", "rd", "$"]);

const PATRON_PREFIJO_MONTO = /^(rd\$|rd|\$)/;

// La normalización quita la diacrítica de la «ñ» igual que unaccent en el
// SQL: «año» se compara como «ano».
/** Rangos que siguen a «este»/«esta» (§4.3: «esta semana», «este año»). */
const RANGOS_DE_ESTE = new Map([
  ["semana", rangoEstaSemana],
  ["mes", rangoEsteMes],
  ["trimestre", rangoEsteTrimestre],
  ["ano", rangoEsteAnio],
]);

/** Rangos que se forman con palabra + «pasado»/«pasada». */
const RANGOS_DEL_PASADO = new Map([
  ["semana", rangoSemanaPasada],
  ["mes", rangoMesAnterior],
  ["ano", rangoAnioAnterior],
]);

interface Token {
  /** Palabra limpia, en minúsculas y con acentos. Es la que se busca como texto. */
  crudo: string;
  /** Palabra en minúsculas, sin acentos y sin puntuación en los bordes. */
  norm: string;
}

/**
 * Interpreta el término de búsqueda y devuelve la intención para la RPC
 * (§4.3). Pura: no consulta nada y solo depende del término y de la fecha de
 * hoy en República Dominicana.
 */
export function interpretar(termino: string): IntencionBusqueda {
  const tokens = tokenizar(termino);

  // 1. El término completo puede ser un identificador exacto.
  const unico = tokens.length === 1 ? tokens[0] : undefined;
  if (unico != null) {
    const exacto = identificadorExacto(unico);
    if (exacto != null) return { ...exacto, confianza: 1 };
  }

  // 2. Frase: fechas primero, señales y texto después.
  const hoy = hoyEnRd();
  const fechas = extraerFechas(tokens, hoy);
  const senales = extraerSenales(fechas.resto);
  const entidad = resolverEntidad(senales.conceptos);
  const texto = senales.texto.join(" ").slice(0, 80);

  const intencion: IntencionBusqueda = {
    confianza: confianzaDe({
      exacto: senales.ncf != null || senales.numero != null || senales.identificacion != null,
      rango: fechas.rango != null,
      monto: senales.monto != null,
      texto,
      entidad,
    }),
  };

  if (texto.length > 0) intencion.texto = texto;
  if (entidad != null) intencion.entidad = entidad;
  if (senales.ncf != null) intencion.ncf = senales.ncf;
  if (senales.numero != null) intencion.numero = senales.numero;
  if (senales.identificacion != null) intencion.identificacion = senales.identificacion;
  if (senales.monto != null) intencion.monto = senales.monto;
  if (fechas.rango != null) {
    intencion.desde = fechas.rango.desde;
    intencion.hasta = fechas.rango.hasta;
  }

  return intencion;
}

/** Parte el término en tokens: minúsculas, sin puntuación en los bordes. */
function tokenizar(termino: string): Token[] {
  return termino
    .toLowerCase()
    .split(/\s+/)
    .map((palabra) => {
      const crudo = palabra.replace(/^[^a-z0-9#$]+/g, "").replace(/[^a-z0-9$]+$/g, "");
      const norm = crudo.normalize("NFD").replace(/\p{Diacritic}/gu, "");
      return { crudo, norm };
    })
    .filter((token) => token.crudo.length > 0);
}

/** NCF: letra + 2 dígitos + 8 o más alfanuméricos (`B0100000123`, `E34…`). */
function esNcf(norm: string): boolean {
  return /^[a-z]\d{2}[a-z0-9]{8,}$/.test(norm);
}

/** Número de documento del término completo, con o sin `#` (§4.3: `66`, `#1258`). */
function numeroDeDocumento(norm: string): number | null {
  const encontrado = /^#?(\d{1,6})$/.exec(norm);
  if (encontrado == null || encontrado[1] == null) return null;

  const numero = Number(encontrado[1]);
  return Number.isSafeInteger(numero) ? numero : null;
}

/** `#número` dentro de una frase: el `#` marca la intención exacta. */
function numeroConAlmudilla(norm: string): number | null {
  const encontrado = /^#(\d{1,6})$/.exec(norm);
  if (encontrado == null || encontrado[1] == null) return null;

  const numero = Number(encontrado[1]);
  return Number.isSafeInteger(numero) ? numero : null;
}

/** RNC (9) o cédula (11), con o sin guiones; devuelve solo dígitos. */
function identificacionDe(norm: string): string | null {
  if (/^\d{9}$/.test(norm) || /^\d{11}$/.test(norm)) return norm;
  if (/^\d+(?:-\d+)+$/.test(norm)) {
    const digitos = norm.replace(/-/g, "");
    if (digitos.length === 9 || digitos.length === 11) return digitos;
  }
  return null;
}

/** Identificador exacto del término completo, o null si no es ninguno. */
function identificadorExacto(token: Token): Pick<IntencionBusqueda, "ncf" | "numero" | "identificacion"> | null {
  if (esNcf(token.norm)) return { ncf: token.crudo.toUpperCase() };
  const numero = numeroDeDocumento(token.norm);
  if (numero != null) return { numero };
  const identificacion = identificacionDe(token.norm);
  if (identificacion != null) return { identificacion };
  return null;
}

/**
 * Monto de un token: con prefijo pegado (`RD$4,500`), con separadores
 * (`4,500`, `1,250.00`, `4.500,50`) o pelado de 4 a 8 dígitos (`4500`).
 * `exigirDigitos` se usa cuando el token va solo: detrás de un prefijo suelto
 * cualquier cantidad vale (`RD$ 12`).
 */
function montoDe(norm: string, exigirDigitos: boolean): number | null {
  const numero = norm.replace(PATRON_PREFIJO_MONTO, "");
  if (!/^\d+(?:[.,]\d+)*$/.test(numero)) return null;

  const pegado = numero !== norm;
  if (exigirDigitos && !pegado && !/[.,]/.test(numero) && (numero.length < 4 || numero.length > 8)) {
    return null;
  }

  return convertirMonto(numero);
}

/**
 * Convierte la parte numérica al valor del monto. Con dos separadores el
 * último es el decimal; con uno solo, tres dígitos detrás indican miles
 * (`4,500` → 4500) y cualquier otra cantidad indica decimales (`4500,50`).
 */
function convertirMonto(valor: string): number | null {
  let numero = valor;

  if (numero.includes(",") && numero.includes(".")) {
    const decimal = numero.lastIndexOf(",") > numero.lastIndexOf(".") ? "," : ".";
    const miles = decimal === "," ? "." : ",";
    numero = numero.split(miles).join("").replace(decimal, ".");
  } else if (numero.includes(",")) {
    numero = /^\d{1,3}(,\d{3})+$/.test(numero) ? numero.replace(/,/g, "") : numero.replace(",", ".");
  } else if (numero.includes(".")) {
    numero = /^\d{1,3}(\.\d{3})+$/.test(numero) ? numero.replace(/\./g, "") : numero;
  }

  const monto = Number(numero);
  return Number.isFinite(monto) ? monto : null;
}

/** «pasado» o «pasada», las dos formas del calificativo de los rangos. */
function esPasado(norm: string | undefined): boolean {
  return norm === "pasado" || norm === "pasada";
}

/** Año de cuatro dígitos entre 1900 y 2099. */
function esAnio(norm: string | undefined): boolean {
  return norm != null && /^(19|20)\d{2}$/.test(norm);
}

function rangoMes(anio: number, mes: number): RangoFechas {
  const inicio = new Date(anio, mes, 1);
  return { desde: format(inicio, FORMATO_ISO), hasta: format(endOfMonth(inicio), FORMATO_ISO) };
}

function rangoAnio(anio: number): RangoFechas {
  return { desde: `${anio}-01-01`, hasta: `${anio}-12-31` };
}

/** La semana anterior a la actual (lunes a domingo), reutilizando `rangos.ts`. */
function rangoSemanaPasada(hoy: string): RangoFechas {
  const haceUnaSemana = format(subDays(parse(hoy, FORMATO_ISO, new Date()), 7), FORMATO_ISO);
  return rangoEstaSemana(haceUnaSemana);
}

interface SaltoFecha {
  rango: RangoFechas;
  /** Tokens que se consumen, incluidos «de», «del» y el año. */
  consumidos: number;
}

/**
 * Recorre los tokens y separa los rangos de fechas del resto. Devuelve el
 * último rango reconocido (si la frase trae dos, gana el más reciente) y los
 * tokens que no eran fecha.
 */
function extraerFechas(tokens: readonly Token[], hoy: string): { rango: RangoFechas | null; resto: Token[] } {
  const resto: Token[] = [];
  let rango: RangoFechas | null = null;

  let i = 0;
  while (i < tokens.length) {
    const salto = interpretarFecha(tokens, i, hoy);
    if (salto != null) {
      rango = salto.rango;
      i += salto.consumidos;
      continue;
    }

    const token = tokens[i];
    if (token != null) resto.push(token);
    i += 1;
  }

  return { rango, resto };
}

/** Rango que empieza en la posición `i`, o null si ahí no hay ninguna fecha. */
function interpretarFecha(tokens: readonly Token[], i: number, hoy: string): SaltoFecha | null {
  const actual = tokens[i]?.norm ?? "";
  const siguiente = tokens[i + 1]?.norm ?? "";

  if (actual === "este" || actual === "esta") {
    const obtener = RANGOS_DE_ESTE.get(siguiente);
    if (obtener != null) return { rango: obtener(hoy), consumidos: 2 };
    return null;
  }

  if (esPasado(siguiente)) {
    const obtener = RANGOS_DEL_PASADO.get(actual);
    if (obtener != null) return { rango: obtener(hoy), consumidos: 2 };
  }

  if (actual === "hoy") return { rango: rangoHoy(hoy), consumidos: 1 };
  if (actual === "ayer") return { rango: rangoAyer(hoy), consumidos: 1 };

  const anioMes = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(actual);
  if (anioMes != null && anioMes[1] != null && anioMes[2] != null) {
    return { rango: rangoMes(Number(anioMes[1]), Number(anioMes[2]) - 1), consumidos: 1 };
  }

  if (esAnio(actual)) return { rango: rangoAnio(Number(actual)), consumidos: 1 };

  const mes = MESES[actual];
  if (mes != null) return saltoDelMes(tokens, i, mes, hoy);

  return null;
}

/**
 * Mes con su contexto: «octubre» (año en curso), «octubre 2025», «octubre de
 * 2025», «octubre del año pasado» y «octubre pasado» (año anterior).
 */
function saltoDelMes(tokens: readonly Token[], i: number, mes: number, hoy: string): SaltoFecha {
  const anioActual = Number(hoy.slice(0, 4));

  if (esPasado(tokens[i + 1]?.norm)) {
    return { rango: rangoMes(anioActual - 1, mes), consumidos: 2 };
  }

  let j = i + 1;
  if (tokens[j]?.norm === "de" || tokens[j]?.norm === "del") j += 1;

  const expuesto = tokens[j]?.norm;
  if (esAnio(expuesto)) return { rango: rangoMes(Number(expuesto), mes), consumidos: j - i + 1 };

  if (tokens[j]?.norm === "ano" && esPasado(tokens[j + 1]?.norm)) {
    return { rango: rangoMes(anioActual - 1, mes), consumidos: j + 2 - i };
  }

  return { rango: rangoMes(anioActual, mes), consumidos: 1 };
}

interface SenalNumerica {
  ncf?: string;
  numero?: number;
  identificacion?: string;
  monto?: number;
  consumidos: number;
}

/** Señal numérica en la posición `i`, o null si el token no trae ninguna. */
function senalNumerica(tokens: readonly Token[], i: number): SenalNumerica | null {
  const actual = tokens[i]?.norm ?? "";
  const siguiente = tokens[i + 1]?.norm ?? "";

  if (esNcf(actual)) return { ncf: (tokens[i]?.crudo ?? "").toUpperCase(), consumidos: 1 };

  const numero = numeroConAlmudilla(actual);
  if (numero != null) return { numero, consumidos: 1 };

  const identificacion = identificacionDe(actual);
  if (identificacion != null) return { identificacion, consumidos: 1 };

  if (PREFIJOS_MONTO.has(actual)) {
    const monto = montoDe(siguiente, false);
    if (monto != null) return { monto, consumidos: 2 };
  }

  const monto = montoDe(actual, true);
  if (monto != null) return { monto, consumidos: 1 };

  return null;
}

interface Senales {
  ncf?: string;
  numero?: number;
  identificacion?: string;
  monto?: number;
  conceptos: Set<string>;
  texto: string[];
}

/** Saca NCF, números, identificaciones, montos, entidades y stopwords. */
function extraerSenales(tokens: readonly Token[]): Senales {
  const salida: Senales = { conceptos: new Set(), texto: [] };
  const hayNota = tokens.some((token) => token.norm === "nota" || token.norm === "notas");

  let i = 0;
  while (i < tokens.length) {
    const numerica = senalNumerica(tokens, i);
    if (numerica != null) {
      aplicarSenal(salida, numerica);
      i += numerica.consumidos;
      continue;
    }

    const token = tokens[i];
    const norm = token?.norm ?? "";
    const concepto = CONCEPTOS[norm];
    if (concepto != null && consumeConcepto(concepto, hayNota)) {
      salida.conceptos.add(concepto);
      i += 1;
      continue;
    }

    if (STOPWORDS.has(norm)) {
      i += 1;
      continue;
    }

    if (token != null) salida.texto.push(token.crudo);
    i += 1;
  }

  return salida;
}

function aplicarSenal(salida: Senales, senal: SenalNumerica): void {
  if (senal.ncf != null) salida.ncf = senal.ncf;
  else if (senal.numero != null) salida.numero = senal.numero;
  else if (senal.identificacion != null) salida.identificacion = senal.identificacion;
  else if (senal.monto != null) salida.monto = senal.monto;
}

/**
 * «crédito» y «débito» solo cuentan como entidad cuando hay una «nota» en la
 * frase; solos se quedan en el texto («crédito fiscal»).
 */
function consumeConcepto(concepto: string, hayNota: boolean): boolean {
  if (concepto === "credito" || concepto === "debito") return hayNota;
  return true;
}

function resolverEntidad(conceptos: ReadonlySet<string>): EntidadBusqueda | undefined {
  for (const regla of REGLAS_ENTIDAD) {
    if (regla.requiere.every((palabra) => conceptos.has(palabra))) return regla.entidad;
  }
  return undefined;
}

interface Evaluacion {
  exacto: boolean;
  rango: boolean;
  monto: boolean;
  texto: string;
  entidad: EntidadBusqueda | undefined;
}

/**
 * Heurística de confianza (§4.3): 1 para identificadores exactos, 0.9 fecha +
 * texto, 0.85 fecha sola, 0.8 monto + texto, 0.7 monto solo, 0.6 solo texto,
 * 0.5 entidad sola y 0.3 cuando no entendió nada.
 */
function confianzaDe(evaluacion: Evaluacion): number {
  if (evaluacion.exacto) return 1;
  if (evaluacion.rango && evaluacion.texto.length > 0) return 0.9;
  if (evaluacion.rango) return 0.85;
  if (evaluacion.monto && evaluacion.texto.length > 0) return 0.8;
  if (evaluacion.monto) return 0.7;
  if (evaluacion.texto.length > 0) return 0.6;
  if (evaluacion.entidad != null) return 0.5;
  return 0.3;
}
