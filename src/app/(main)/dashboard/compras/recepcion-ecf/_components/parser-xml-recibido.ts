export interface ItemEcfRecibido {
  numeroLinea: number | null;
  nombre: string;
  cantidad: number | null;
  precioUnitario: number | null;
  monto: number | null;
}

export interface EcfXmlRecibido {
  rncEmisor: string;
  razonSocialEmisor: string;
  correoEmisor: string | null;
  rncComprador: string | null;
  tipoEcf: string;
  encf: string;
  fechaEmision: string;
  montoGravado: number | null;
  montoExento: number | null;
  totalItbis: number | null;
  montoTotal: number;
  codigoSeguridad: string | null;
  items: ItemEcfRecibido[];
}

export type ResultadoParseoEcfRecibido = { ok: true; ecf: EcfXmlRecibido } | { ok: false; error: string };

const TIPOS_ECF_VALIDOS = new Set(["31", "32", "33", "34", "41", "43", "44", "45", "46", "47"]);

function decodificarXml(texto: string): string {
  const entidades: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
  };

  return texto.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (coincidencia, entidad: string) => {
    const clave = entidad.toLowerCase();
    const conocida = entidades[clave];
    if (conocida !== undefined) return conocida;

    const esHexadecimal = clave.startsWith("#x");
    const codigo = Number.parseInt(clave.slice(esHexadecimal ? 2 : 1), esHexadecimal ? 16 : 10);
    if (!Number.isInteger(codigo) || codigo < 0 || codigo > 0x10ffff) return coincidencia;
    return String.fromCodePoint(codigo);
  });
}

function limpiarTextoXml(texto: string): string {
  return decodificarXml(texto.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim());
}

function expresionTag(nombre: string, global = false): RegExp {
  return new RegExp(
    `<(?:[A-Za-z_][\\w.-]*:)?${nombre}(?:\\s[^<>]*)?>([\\s\\S]*?)<\\/(?:[A-Za-z_][\\w.-]*:)?${nombre}\\s*>`,
    global ? "gi" : "i",
  );
}

function extraerTag(xml: string, nombre: string): string | null {
  const valor = expresionTag(nombre).exec(xml)?.[1];
  if (valor == null) return null;
  const limpio = limpiarTextoXml(valor);
  return limpio === "" ? null : limpio;
}

function extraerBloques(xml: string, nombre: string): string[] {
  return [...xml.matchAll(expresionTag(nombre, true))].map((coincidencia) => coincidencia[1] ?? "");
}

function numeroXml(valor: string | null): number | null {
  if (valor == null) return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function raizEcfPresente(xml: string): boolean {
  const apertura = /<\s*(?:[A-Za-z_][\w.-]*:)?ECF(?:\s[^<>]*)?>/i.test(xml);
  const cierre = /<\/\s*(?:[A-Za-z_][\w.-]*:)?ECF\s*>/i.test(xml);
  return apertura && cierre;
}

function errorParseo(mensaje: string): ResultadoParseoEcfRecibido {
  return { ok: false, error: mensaje };
}

interface CabeceraEcfCruda {
  tipoEcf: string;
  encf: string;
  rncEmisor: string;
  razonSocialEmisor: string;
  fechaEmision: string;
  montoTotal: number | null;
}

function leerCabecera(xml: string): CabeceraEcfCruda {
  return {
    tipoEcf: extraerTag(xml, "TipoeCF")?.replace(/^E/i, "") ?? "",
    encf: (extraerTag(xml, "eNCF") ?? "").toUpperCase(),
    rncEmisor: extraerTag(xml, "RNCEmisor") ?? "",
    razonSocialEmisor: extraerTag(xml, "RazonSocialEmisor") ?? "",
    fechaEmision: extraerTag(xml, "FechaEmision") ?? "",
    montoTotal: numeroXml(extraerTag(xml, "MontoTotal")),
  };
}

function validarCabecera(cabecera: CabeceraEcfCruda): string[] {
  const faltantes: string[] = [];
  if (!TIPOS_ECF_VALIDOS.has(cabecera.tipoEcf)) faltantes.push("TipoeCF");
  if (!/^E(31|32|33|34|41|43|44|45|46|47)\d{10}$/.test(cabecera.encf)) faltantes.push("e-NCF");
  if (!/^\d{9}(\d{2})?$/.test(cabecera.rncEmisor)) faltantes.push("RNCEmisor");
  if (cabecera.razonSocialEmisor === "") faltantes.push("RazonSocialEmisor");
  if (cabecera.fechaEmision === "") faltantes.push("FechaEmision");
  if (cabecera.montoTotal == null) faltantes.push("MontoTotal");
  return faltantes;
}

function parsearItems(xml: string): ItemEcfRecibido[] {
  return extraerBloques(xml, "Item").map((item) => ({
    numeroLinea: numeroXml(extraerTag(item, "NumeroLinea")),
    nombre: extraerTag(item, "NombreItem") ?? "",
    cantidad: numeroXml(extraerTag(item, "CantidadItem")),
    precioUnitario: numeroXml(extraerTag(item, "PrecioUnitarioItem")),
    monto: numeroXml(extraerTag(item, "MontoItem")),
  }));
}

function montoGravado(xml: string): number {
  const gravadoTotal = numeroXml(extraerTag(xml, "MontoGravadoTotal"));
  if (gravadoTotal != null) return gravadoTotal;
  const gravadoI1 = numeroXml(extraerTag(xml, "MontoGravadoI1")) ?? 0;
  const gravadoI2 = numeroXml(extraerTag(xml, "MontoGravadoI2")) ?? 0;
  const gravadoI3 = numeroXml(extraerTag(xml, "MontoGravadoI3")) ?? 0;
  return gravadoI1 + gravadoI2 + gravadoI3;
}

function construirEcf(xml: string, cabecera: CabeceraEcfCruda, items: ItemEcfRecibido[]): EcfXmlRecibido {
  const firma = extraerTag(xml, "SignatureValue")?.replace(/\s+/g, "");
  return {
    rncEmisor: cabecera.rncEmisor,
    razonSocialEmisor: cabecera.razonSocialEmisor,
    correoEmisor: extraerTag(xml, "CorreoEmisor"),
    rncComprador: extraerTag(xml, "RNCComprador"),
    tipoEcf: cabecera.tipoEcf,
    encf: cabecera.encf,
    fechaEmision: cabecera.fechaEmision,
    montoGravado: montoGravado(xml),
    montoExento: numeroXml(extraerTag(xml, "MontoExento")),
    totalItbis: numeroXml(extraerTag(xml, "TotalITBIS")),
    montoTotal: cabecera.montoTotal ?? 0,
    codigoSeguridad: firma ? firma.slice(0, 6) : null,
    items,
  };
}

export function parsearXmlEcfRecibido(xml: string): ResultadoParseoEcfRecibido {
  if (xml.trim() === "") return errorParseo("El archivo está vacío: sube un XML e-CF emitido por tu proveedor.");
  if (!raizEcfPresente(xml)) {
    return errorParseo("El archivo no es un XML e-CF válido: no se encontró el nodo principal <ECF>.");
  }

  const cabecera = leerCabecera(xml);
  const faltantes = validarCabecera(cabecera);
  if (faltantes.length > 0) {
    return errorParseo(`El XML no es un e-CF válido: falta o es inválido ${faltantes.join(", ")}.`);
  }

  const items = parsearItems(xml);
  if (items.length === 0) {
    return errorParseo("El XML no es un e-CF válido: no trae líneas en DetallesItems.");
  }

  return { ok: true, ecf: construirEcf(xml, cabecera, items) };
}
