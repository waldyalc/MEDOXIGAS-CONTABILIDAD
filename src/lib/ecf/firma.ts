import type { MetadatosCertificado, ParCertificadoEcf } from "./tipos";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createSign,
  createVerify,
  generateKeyPairSync,
  randomBytes,
  scryptSync,
  X509Certificate,
} from "node:crypto";

const XMLDSIG_NS = "http://www.w3.org/2000/09/xmldsig#";
const C14N_ALGORITHM = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
const RSA_SHA256_ALGORITHM = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
const ENVELOPED_ALGORITHM = "http://www.w3.org/2000/09/xmldsig#enveloped-signature";
const SHA256_ALGORITHM = "http://www.w3.org/2001/04/xmlenc#sha256";

export interface ResultadoFirmaXmlDsig {
  xmlFirmado: string;
  signatureValue: string;
  codigoSeguridad: string;
  digestValue: string;
}

export interface ResultadoVerificacionXmlDsig {
  valida: boolean;
  motivo?: string;
  codigoSeguridad?: string;
}

interface AtributoXml {
  nombre: string;
  valor: string;
}

interface EtiquetaInicialXml {
  nombre: string;
  atributos: AtributoXml[];
  autoCerrada: boolean;
}

const ENTIDADES_XML: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: `"`,
  apos: "'",
};

function decodificarEntidadNumerica(entidad: string, codigo: string): string {
  const esHex = codigo.startsWith("#x");
  const numero = Number.parseInt(codigo.slice(esHex ? 2 : 1), esHex ? 16 : 10);
  if (!Number.isInteger(numero) || numero < 0 || numero > 0x10ffff) return entidad;
  return String.fromCodePoint(numero);
}

function decodificarEntidadesXml(texto: string): string {
  return texto.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, (entidad, codigo: string) => {
    return ENTIDADES_XML[codigo] ?? decodificarEntidadNumerica(entidad, codigo);
  });
}

function escaparTextoCanonico(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escaparAtributoCanonico(texto: string): string {
  return escaparTextoCanonico(texto)
    .replace(/"/g, "&quot;")
    .replace(/\t/g, "&#9;")
    .replace(/\n/g, "&#10;")
    .replace(/\r/g, "&#13;");
}

function normalizarTextoXml(texto: string): string {
  return escaparTextoCanonico(decodificarEntidadesXml(texto.replace(/\r\n/g, "\n").replace(/\r/g, "\n")));
}

function buscarFinEtiqueta(xml: string, inicio: number): number {
  let comilla: string | null = null;
  for (let indice = inicio; indice < xml.length; indice += 1) {
    const caracter = xml[indice];
    if (comilla) {
      if (caracter === comilla) comilla = null;
    } else if (caracter === `"` || caracter === "'") {
      comilla = caracter;
    } else if (caracter === ">") {
      return indice;
    }
  }
  throw new Error("XML mal formado: hay una etiqueta sin cierre");
}

function saltarEspaciosXml(texto: string, indice: number): number {
  let actual = indice;
  while (actual < texto.length && /\s/.test(texto[actual] ?? "")) actual += 1;
  return actual;
}

function leerAtributoXml(texto: string, indiceInicial: number): { atributo: AtributoXml; siguiente: number } | null {
  let indice = saltarEspaciosXml(texto, indiceInicial);
  if (indice >= texto.length) return null;
  const inicioNombre = indice;
  while (indice < texto.length && !/[\s=]/.test(texto[indice] ?? "")) indice += 1;
  const nombre = texto.slice(inicioNombre, indice);
  indice = saltarEspaciosXml(texto, indice);
  if (texto[indice] !== "=") throw new Error(`XML mal formado: el atributo ${nombre} no tiene valor`);
  indice = saltarEspaciosXml(texto, indice + 1);
  const comilla = texto[indice];
  if (comilla !== `"` && comilla !== "'")
    throw new Error(`XML mal formado: el atributo ${nombre} no está entrecomillado`);
  const inicioValor = indice + 1;
  const finValor = texto.indexOf(comilla, inicioValor);
  if (finValor === -1) throw new Error(`XML mal formado: el atributo ${nombre} no cierra su comilla`);
  return { atributo: { nombre, valor: texto.slice(inicioValor, finValor) }, siguiente: finValor + 1 };
}

function parsearEtiquetaInicial(interiorOriginal: string): EtiquetaInicialXml {
  let interior = interiorOriginal.trim();
  const autoCerrada = interior.endsWith("/");
  if (autoCerrada) interior = interior.slice(0, -1).trimEnd();
  const nombreMatch = interior.match(/^[^\s/>]+/);
  if (!nombreMatch?.[0]) throw new Error("XML mal formado: etiqueta inicial sin nombre");
  const nombre = nombreMatch[0];
  const atributos: AtributoXml[] = [];
  let indice = nombre.length;
  while (indice < interior.length) {
    const leido = leerAtributoXml(interior, indice);
    if (!leido) break;
    atributos.push(leido.atributo);
    indice = leido.siguiente;
  }
  return { nombre, atributos, autoCerrada };
}

function compararNombres(izquierda: string, derecha: string): number {
  if (izquierda < derecha) return -1;
  if (izquierda > derecha) return 1;
  return 0;
}

function canonizarEtiquetaInicial(etiqueta: EtiquetaInicialXml): string {
  const atributos = [...etiqueta.atributos].sort((a, b) => compararNombres(a.nombre, b.nombre));
  const textoAtributos = atributos
    .map((atributo) => ` ${atributo.nombre}="${escaparAtributoCanonico(decodificarEntidadesXml(atributo.valor))}"`)
    .join("");
  return `<${etiqueta.nombre}${textoAtributos}>`;
}

function esEtiquetaSignature(nombre: string): boolean {
  return nombre === "Signature" || nombre.endsWith(":Signature");
}

interface EstadoCanonizacionXml {
  salida: string;
  posicion: number;
  omitidas: number;
  pila: string[];
}

function agregarTextoCanonico(estado: EstadoCanonizacionXml, texto: string): void {
  if (estado.pila.length === 0 && texto.trim() === "") return;
  if (estado.omitidas === 0) estado.salida += normalizarTextoXml(texto);
}

function saltarHasta(xml: string, inicio: number, terminador: string, mensaje: string): number {
  const fin = xml.indexOf(terminador, inicio);
  if (fin === -1) throw new Error(mensaje);
  return fin + terminador.length;
}

function procesarSeccionEspecial(xml: string, inicio: number, estado: EstadoCanonizacionXml): number | null {
  if (xml.startsWith("<?", inicio))
    return saltarHasta(xml, inicio + 2, "?>", "XML mal formado: declaración sin cierre");
  if (xml.startsWith("<!--", inicio))
    return saltarHasta(xml, inicio + 4, "-->", "XML mal formado: comentario sin cierre");
  if (xml.startsWith("<![CDATA[", inicio)) {
    const fin = xml.indexOf("]]>", inicio + 9);
    if (fin === -1) throw new Error("XML mal formado: CDATA sin cierre");
    agregarTextoCanonico(estado, xml.slice(inicio + 9, fin));
    return fin + 3;
  }
  if (xml.startsWith("<!", inicio)) return buscarFinEtiqueta(xml, inicio + 2) + 1;
  return null;
}

function procesarCierreXml(estado: EstadoCanonizacionXml, interior: string): void {
  const nombre = interior.slice(1).trim().split(/\s/)[0] ?? "";
  if (estado.omitidas > 0) {
    estado.omitidas -= 1;
    return;
  }
  const esperado = estado.pila.pop();
  if (esperado !== nombre) {
    throw new Error(`XML mal formado: se cerró ${nombre} y se esperaba ${esperado ?? "ninguna etiqueta"}`);
  }
  estado.salida += `</${nombre}>`;
}

function procesarInicioXml(estado: EstadoCanonizacionXml, interior: string, omitirFirma: boolean): void {
  const etiqueta = parsearEtiquetaInicial(interior);
  if (estado.omitidas > 0) {
    if (!etiqueta.autoCerrada) estado.omitidas += 1;
    return;
  }
  if (omitirFirma && esEtiquetaSignature(etiqueta.nombre)) {
    if (!etiqueta.autoCerrada) estado.omitidas = 1;
    return;
  }
  estado.salida += canonizarEtiquetaInicial(etiqueta);
  if (etiqueta.autoCerrada) {
    estado.salida += `</${etiqueta.nombre}>`;
  } else {
    estado.pila.push(etiqueta.nombre);
  }
}

export function canonicalizarXmlBasico(xml: string, omitirFirma = false): string {
  const estado: EstadoCanonizacionXml = { salida: "", posicion: 0, omitidas: 0, pila: [] };

  while (estado.posicion < xml.length) {
    const inicioEtiqueta = xml.indexOf("<", estado.posicion);
    if (inicioEtiqueta === -1) {
      agregarTextoCanonico(estado, xml.slice(estado.posicion));
      break;
    }
    agregarTextoCanonico(estado, xml.slice(estado.posicion, inicioEtiqueta));

    const siguienteEspecial = procesarSeccionEspecial(xml, inicioEtiqueta, estado);
    if (siguienteEspecial !== null) {
      estado.posicion = siguienteEspecial;
      continue;
    }

    const finEtiqueta = buscarFinEtiqueta(xml, inicioEtiqueta + 1);
    const interior = xml.slice(inicioEtiqueta + 1, finEtiqueta);
    if (interior.startsWith("/")) {
      procesarCierreXml(estado, interior);
    } else {
      procesarInicioXml(estado, interior, omitirFirma);
    }
    estado.posicion = finEtiqueta + 1;
  }

  if (estado.omitidas !== 0) throw new Error("XML mal formado: la firma no cierra correctamente");
  if (estado.pila.length !== 0) throw new Error("XML mal formado: hay etiquetas sin cerrar");
  return estado.salida;
}

function construirSignedInfo(digestValue: string): string {
  return `<SignedInfo xmlns="${XMLDSIG_NS}"><CanonicalizationMethod Algorithm="${C14N_ALGORITHM}"></CanonicalizationMethod><SignatureMethod Algorithm="${RSA_SHA256_ALGORITHM}"></SignatureMethod><Reference URI=""><Transforms><Transform Algorithm="${ENVELOPED_ALGORITHM}"></Transform></Transforms><DigestMethod Algorithm="${SHA256_ALGORITHM}"></DigestMethod><DigestValue>${digestValue}</DigestValue></Reference></SignedInfo>`;
}

function extraerBloque(xml: string, nombre: string): string | null {
  const match = xml.match(new RegExp(`<${nombre}(?:\\s[^>]*)?>[\\s\\S]*?</${nombre}>`));
  return match?.[0] ?? null;
}

function extraerValorEtiqueta(xml: string, nombre: string): string | null {
  const match = xml.match(new RegExp(`<${nombre}>([\\s\\S]*?)</${nombre}>`));
  return match?.[1] ?? null;
}

function certificadoBase64(certificadoPem: string): string {
  const contenido = certificadoPem
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s/g, "");
  if (contenido === "") throw new Error("El certificado PEM está vacío");
  return contenido;
}

function primerCertificadoPem(certificadoPem: string): string {
  const match = certificadoPem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/);
  return match?.[0] ?? certificadoPem;
}

function insertarAntesDeCierreRaiz(xml: string, bloque: string): string {
  const indice = xml.lastIndexOf("</");
  if (indice === -1) throw new Error("El XML no tiene una etiqueta raíz de cierre");
  return `${xml.slice(0, indice)}${bloque}${xml.slice(indice)}`;
}

export function firmarXmlDsig(
  xmlSinFirma: string,
  clavePrivadaPem: string,
  certificadoPem: string,
): ResultadoFirmaXmlDsig {
  const canonico = canonicalizarXmlBasico(xmlSinFirma, true);
  const digestValue = createHash("sha256").update(canonico, "utf8").digest("base64");
  const signedInfo = construirSignedInfo(digestValue);
  const firmante = createSign("RSA-SHA256");
  firmante.update(signedInfo, "utf8");
  firmante.end();
  const signatureValue = firmante.sign(clavePrivadaPem, "base64");
  const certificado = certificadoBase64(certificadoPem);
  const bloqueFirma = `<Signature xmlns="${XMLDSIG_NS}">${signedInfo}<SignatureValue>${signatureValue}</SignatureValue><KeyInfo><X509Data><X509Certificate>${certificado}</X509Certificate></X509Data></KeyInfo></Signature>`;
  return {
    xmlFirmado: insertarAntesDeCierreRaiz(xmlSinFirma, bloqueFirma),
    signatureValue,
    codigoSeguridad: signatureValue.slice(0, 6),
    digestValue,
  };
}

export function verificarFirmaXmlDsig(xmlFirmado: string): ResultadoVerificacionXmlDsig {
  try {
    const bloqueFirma = extraerBloque(xmlFirmado, "Signature");
    if (!bloqueFirma) return { valida: false, motivo: "El XML no contiene una firma XMLDSig" };
    const signatureValue = extraerValorEtiqueta(bloqueFirma, "SignatureValue")?.trim();
    const digestEsperado = extraerValorEtiqueta(bloqueFirma, "DigestValue")?.trim();
    const certificadoBase64Xml = extraerValorEtiqueta(bloqueFirma, "X509Certificate")?.replace(/\s/g, "");
    const signedInfo = extraerBloque(bloqueFirma, "SignedInfo");
    const codigoSeguridad = signatureValue?.slice(0, 6);
    if (!signatureValue || !digestEsperado || !certificadoBase64Xml || !signedInfo) {
      return { valida: false, motivo: "La firma XMLDSig está incompleta", codigoSeguridad };
    }

    const canonico = canonicalizarXmlBasico(xmlFirmado, true);
    const digestCalculado = createHash("sha256").update(canonico, "utf8").digest("base64");
    if (digestCalculado !== digestEsperado) {
      return { valida: false, motivo: "El contenido del XML fue alterado después de la firma", codigoSeguridad };
    }

    const certificadoPem = `-----BEGIN CERTIFICATE-----\n${certificadoBase64Xml}\n-----END CERTIFICATE-----`;
    const certificado = new X509Certificate(certificadoPem);
    const signedInfoCanonico = canonicalizarXmlBasico(signedInfo, false);
    const verificador = createVerify("RSA-SHA256");
    verificador.update(signedInfoCanonico, "utf8");
    verificador.end();
    const valida = verificador.verify(certificado.publicKey, signatureValue, "base64");
    return valida
      ? { valida: true, codigoSeguridad }
      : { valida: false, motivo: "La firma criptográfica no corresponde con el certificado", codigoSeguridad };
  } catch (error) {
    return { valida: false, motivo: error instanceof Error ? error.message : "No se pudo verificar la firma XMLDSig" };
  }
}

function extraerCn(nombre: string): string {
  const match = nombre.match(/(?:^|\n|,)\s*CN=([^\n,]+)/);
  return match?.[1]?.trim() ?? nombre.trim();
}

export function leerMetadatosCertificado(certificadoPem: string, ahora = new Date()): MetadatosCertificado {
  const certificado = new X509Certificate(primerCertificadoPem(certificadoPem));
  const validoDesde = new Date(certificado.validFrom);
  const validoHasta = new Date(certificado.validTo);
  const milisegundosDia = 24 * 60 * 60 * 1000;
  return {
    titular: extraerCn(certificado.subject),
    emisor: extraerCn(certificado.issuer),
    numeroSerie: certificado.serialNumber,
    validoDesde,
    validoHasta,
    vigente: ahora.getTime() >= validoDesde.getTime() && ahora.getTime() <= validoHasta.getTime(),
    diasRestantes: Math.ceil((validoHasta.getTime() - ahora.getTime()) / milisegundosDia),
    huellaSha256: certificado.fingerprint256,
  };
}

function bytesLongitud(longitud: number): Buffer {
  if (longitud < 128) return Buffer.from([longitud]);
  const bytes: number[] = [];
  let restante = longitud;
  while (restante > 0) {
    bytes.unshift(restante & 0xff);
    restante = Math.floor(restante / 256);
  }
  return Buffer.from([0x80 + bytes.length, ...bytes]);
}

function tlv(etiqueta: number, contenido: Buffer): Buffer {
  return Buffer.concat([Buffer.from([etiqueta]), bytesLongitud(contenido.length), contenido]);
}

function secuenciaDer(...partes: Buffer[]): Buffer {
  return tlv(0x30, Buffer.concat(partes));
}

function conjuntoDer(...partes: Buffer[]): Buffer {
  return tlv(0x31, Buffer.concat(partes));
}

function enteroDer(valor: number): Buffer {
  return tlv(0x02, Buffer.from([valor]));
}

function enteroBytesDer(bytes: Buffer): Buffer {
  let contenido = Buffer.from(bytes);
  while (contenido.length > 1 && contenido[0] === 0 && (contenido[1] ?? 0) < 0x80) contenido = contenido.subarray(1);
  if ((contenido[0] ?? 0) >= 0x80) contenido = Buffer.concat([Buffer.from([0]), contenido]);
  return tlv(0x02, contenido);
}

function booleanoDer(valor: boolean): Buffer {
  return tlv(0x01, Buffer.from([valor ? 0xff : 0]));
}

function nuloDer(): Buffer {
  return tlv(0x05, Buffer.alloc(0));
}

function oidDer(valor: string): Buffer {
  const partes = valor.split(".").map((parte) => Number.parseInt(parte, 10));
  const primera = partes[0];
  const segunda = partes[1];
  if (primera === undefined || segunda === undefined) throw new Error(`OID inválido: ${valor}`);
  const bytes = [40 * primera + segunda];
  for (const parte of partes.slice(2)) {
    if (!Number.isInteger(parte) || parte < 0) throw new Error(`OID inválido: ${valor}`);
    const codificado = [parte & 0x7f];
    let restante = Math.floor(parte / 128);
    while (restante > 0) {
      codificado.unshift((restante & 0x7f) | 0x80);
      restante = Math.floor(restante / 128);
    }
    bytes.push(...codificado);
  }
  return tlv(0x06, Buffer.from(bytes));
}

function algoritmoDer(oid: string): Buffer {
  return secuenciaDer(oidDer(oid), nuloDer());
}

function utf8Der(valor: string): Buffer {
  return tlv(0x0c, Buffer.from(valor, "utf8"));
}

function printableDer(valor: string): Buffer {
  return tlv(0x13, Buffer.from(valor, "ascii"));
}

function utcDer(fecha: Date): Buffer {
  const anio = String(fecha.getUTCFullYear() % 100).padStart(2, "0");
  const mes = pad(fecha.getUTCMonth() + 1);
  const dia = pad(fecha.getUTCDate());
  const hora = pad(fecha.getUTCHours());
  const minuto = pad(fecha.getUTCMinutes());
  const segundo = pad(fecha.getUTCSeconds());
  return tlv(0x17, Buffer.from(`${anio}${mes}${dia}${hora}${minuto}${segundo}Z`, "ascii"));
}

function pad(valor: number): string {
  return String(valor).padStart(2, "0");
}

function bitStringDer(contenido: Buffer, bitsSinUso = 0): Buffer {
  return tlv(0x03, Buffer.concat([Buffer.from([bitsSinUso]), contenido]));
}

function octetStringDer(contenido: Buffer): Buffer {
  return tlv(0x04, contenido);
}

function explicitoDer(numero: number, contenido: Buffer): Buffer {
  return tlv(0xa0 + numero, contenido);
}

type CodificadorTextoDer = (valor: string) => Buffer;

function nombreX509Der(entradas: Array<{ oid: string; valor: string; codificador: CodificadorTextoDer }>): Buffer {
  return secuenciaDer(
    ...entradas.map((entrada) => conjuntoDer(secuenciaDer(oidDer(entrada.oid), entrada.codificador(entrada.valor)))),
  );
}

function pemDesdeDer(der: Buffer, etiqueta: string): string {
  const base64 = der.toString("base64");
  const lineas: string[] = [];
  for (let indice = 0; indice < base64.length; indice += 64) lineas.push(base64.slice(indice, indice + 64));
  return `-----BEGIN ${etiqueta}-----\n${lineas.join("\n")}\n-----END ${etiqueta}-----\n`;
}

export function generarCertificadoPruebaAutocontenido(rnc: string, razonSocial: string): ParCertificadoEcf {
  if (!/^\d{9}(\d{2})?$/.test(rnc)) throw new Error("El RNC del certificado de prueba debe tener 9 u 11 dígitos");
  if (razonSocial.trim() === "") throw new Error("La razón social del certificado de prueba es obligatoria");

  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const spkiExportada = publicKey.export({ format: "der", type: "spki" });
  if (!Buffer.isBuffer(spkiExportada)) throw new Error("No se pudo exportar la clave pública de prueba");
  const clavePrivadaExportada = privateKey.export({ format: "pem", type: "pkcs8" });
  if (typeof clavePrivadaExportada !== "string") throw new Error("No se pudo exportar la clave privada de prueba");

  const ahora = new Date();
  const validoDesde = new Date(ahora.getTime() - 5 * 60 * 1000);
  const validoHasta = new Date(ahora.getTime() + 2 * 365 * 24 * 60 * 60 * 1000);
  const nombre = nombreX509Der([
    { oid: "2.5.4.6", valor: "DO", codificador: printableDer },
    { oid: "2.5.4.10", valor: razonSocial, codificador: utf8Der },
    { oid: "2.5.4.3", valor: razonSocial, codificador: utf8Der },
    { oid: "2.5.4.5", valor: rnc, codificador: printableDer },
  ]);
  const validez = secuenciaDer(utcDer(validoDesde), utcDer(validoHasta));
  const extensiones = explicitoDer(
    3,
    secuenciaDer(
      secuenciaDer(oidDer("2.5.29.19"), booleanoDer(true), octetStringDer(secuenciaDer())),
      secuenciaDer(oidDer("2.5.29.15"), booleanoDer(true), octetStringDer(bitStringDer(Buffer.from([0xc0]), 6))),
    ),
  );
  const tbs = secuenciaDer(
    explicitoDer(0, enteroDer(2)),
    enteroBytesDer(randomBytes(16)),
    algoritmoDer("1.2.840.113549.1.1.11"),
    nombre,
    validez,
    nombre,
    spkiExportada,
    extensiones,
  );
  const firmante = createSign("RSA-SHA256");
  firmante.update(tbs);
  firmante.end();
  const firma = firmante.sign(privateKey);
  const certificadoDer = secuenciaDer(tbs, algoritmoDer("1.2.840.113549.1.1.11"), bitStringDer(firma));
  const certificadoPem = pemDesdeDer(certificadoDer, "CERTIFICATE");
  const verificacion = new X509Certificate(certificadoPem);
  if (!verificacion.verify(verificacion.publicKey))
    throw new Error("El certificado de prueba generado no supera su propia verificación");
  return { clavePrivadaPem: clavePrivadaExportada, certificadoPem };
}

function derivarClaveAes(claveMaestra: string): Buffer {
  if (/^[0-9a-fA-F]{64}$/.test(claveMaestra)) return Buffer.from(claveMaestra, "hex");
  return scryptSync(claveMaestra, "medoxigas-ecf-aes-v1", 32);
}

export function cifrarSecretoEcf(textoPlano: string, claveMaestra: string): string {
  const clave = derivarClaveAes(claveMaestra);
  const iv = randomBytes(12);
  const cifrador = createCipheriv("aes-256-gcm", clave, iv);
  const cifrado = Buffer.concat([cifrador.update(textoPlano, "utf8"), cifrador.final()]);
  const tag = cifrador.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${cifrado.toString("base64url")}`;
}

export function descifrarSecretoEcf(paquete: string, claveMaestra: string): string {
  const partes = paquete.split(":");
  if (partes.length !== 4 || partes[0] !== "v1") throw new Error("El paquete cifrado no tiene el formato v1 esperado");
  const [, ivTexto, tagTexto, cifradoTexto] = partes;
  if (!ivTexto || !tagTexto || !cifradoTexto) throw new Error("El paquete cifrado está incompleto");
  try {
    const iv = Buffer.from(ivTexto, "base64url");
    const tag = Buffer.from(tagTexto, "base64url");
    const cifrado = Buffer.from(cifradoTexto, "base64url");
    if (iv.length !== 12 || tag.length !== 16) throw new Error("El paquete cifrado tiene parámetros inválidos");
    const descifrador = createDecipheriv("aes-256-gcm", derivarClaveAes(claveMaestra), iv);
    descifrador.setAuthTag(tag);
    return Buffer.concat([descifrador.update(cifrado), descifrador.final()]).toString("utf8");
  } catch {
    throw new Error("No se pudo descifrar el secreto e-CF: clave incorrecta o paquete alterado");
  }
}
