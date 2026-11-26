import { leerMetadatosCertificado } from "./firma";
import type { MetadatosCertificado } from "./tipos";
import { execFile } from "node:child_process";
import { createPublicKey, X509Certificate } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const VARIABLE_CLAVE = "ECF_P12_PASS";

export interface CertificadoPkcs12Leido {
  clavePrivadaPem: string;
  certificadoPem: string;
  cadenaCertificadosPem: string[];
  metadatos: MetadatosCertificado;
}

interface ResultadoOpenssl {
  stdout: string;
  stderr: string;
}

function limpiarSalidaOpenssl(texto: string): string {
  return texto.replace(/pass\s*:[^\s]+/gi, "pass:[protegida]").trim();
}

async function ejecutarOpensslPkcs12(ruta: string, args: string[], contrasena: string): Promise<ResultadoOpenssl> {
  try {
    const resultado = await execFileAsync(
      "openssl",
      ["pkcs12", "-in", ruta, "-passin", `env:${VARIABLE_CLAVE}`, ...args],
      {
        env: { ...process.env, [VARIABLE_CLAVE]: contrasena },
        maxBuffer: 20 * 1024 * 1024,
      },
    );
    return { stdout: resultado.stdout.toString(), stderr: resultado.stderr.toString() };
  } catch (error) {
    const detalle = error instanceof Error ? error.message : "error desconocido";
    // biome-ignore lint/suspicious/noUnnecessaryConditions: execFile propaga objetos de error heterogéneos y stderr no está garantizado por el tipo base
    const stderr = typeof error === "object" && error !== null && "stderr" in error ? String(error.stderr) : detalle;
    throw new Error(limpiarSalidaOpenssl(stderr || detalle));
  }
}

function esErrorLegado(mensaje: string): boolean {
  const texto = mensaje.toLowerCase();
  return texto.includes("unsupported") || texto.includes("legacy") || texto.includes("digital envelope routines");
}

function esErrorContrasena(mensaje: string): boolean {
  const texto = mensaje.toLowerCase();
  return texto.includes("mac verify failure") || texto.includes("password") || texto.includes("contrase");
}

function bloquesPem(contenido: string, etiqueta: string): string[] {
  const expresion = new RegExp(`-----BEGIN ${etiqueta}-----[\\s\\S]+?-----END ${etiqueta}-----`, "g");
  return contenido.match(expresion) ?? [];
}

function primerBossePem(contenido: string, etiquetas: string[]): string | null {
  for (const etiqueta of etiquetas) {
    const bloques = bloquesPem(contenido, etiqueta);
    if (bloques[0]) return `${bloques[0]}\n`;
  }
  return null;
}

function validarLlaveCorrespondeCertificado(clavePrivadaPem: string, certificadoPem: string): void {
  const certificado = new X509Certificate(certificadoPem);
  const publicaDesdeClave = createPublicKey(clavePrivadaPem).export({ format: "der", type: "spki" });
  const publicaCertificado = certificado.publicKey.export({ format: "der", type: "spki" });
  if (
    !Buffer.isBuffer(publicaDesdeClave) ||
    !Buffer.isBuffer(publicaCertificado) ||
    !publicaDesdeClave.equals(publicaCertificado)
  ) {
    throw new Error("La clave privada del certificado PKCS#12 no corresponde con la clave pública del certificado");
  }
}

async function extraerConOpenssl(ruta: string, contrasena: string, legacy: boolean): Promise<CertificadoPkcs12Leido> {
  const prefijo = legacy ? ["-legacy"] : [];
  const [salidaClave, salidaCertificado, salidaCadena] = await Promise.all([
    ejecutarOpensslPkcs12(ruta, [...prefijo, "-nocerts", "-nodes"], contrasena),
    ejecutarOpensslPkcs12(ruta, [...prefijo, "-clcerts", "-nokeys"], contrasena),
    ejecutarOpensslPkcs12(ruta, [...prefijo, "-cacerts", "-nokeys"], contrasena),
  ]);
  const clavePrivadaPem = primerBossePem(salidaClave.stdout, ["PRIVATE KEY", "RSA PRIVATE KEY"]);
  const certificadoPem = primerBossePem(salidaCertificado.stdout, ["CERTIFICATE"]);
  if (!clavePrivadaPem) throw new Error("El archivo PKCS#12 no contiene una clave privada legible");
  if (!certificadoPem) throw new Error("El archivo PKCS#12 no contiene el certificado del titular");
  validarLlaveCorrespondeCertificado(clavePrivadaPem, certificadoPem);
  return {
    clavePrivadaPem,
    certificadoPem,
    cadenaCertificadosPem: bloquesPem(salidaCadena.stdout, "CERTIFICATE").map((bloque) => `${bloque}\n`),
    metadatos: leerMetadatosCertificado(certificadoPem),
  };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: separa cifrado moderno, fallback legacy y errores fiscales sin filtrar la contraseña
export async function leerCertificadoPkcs12(buffer: Buffer, contrasena: string): Promise<CertificadoPkcs12Leido> {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0)
    throw new Error("El archivo PKCS#12 está vacío o no es un buffer válido");
  const carpeta = await mkdtemp(join(tmpdir(), "ecf-p12-"));
  const ruta = join(carpeta, "certificado.p12");
  try {
    await writeFile(ruta, buffer, { mode: 0o600 });
    try {
      return await extraerConOpenssl(ruta, contrasena, false);
    } catch (errorModerno) {
      const mensajeModerno = errorModerno instanceof Error ? errorModerno.message : "";
      if (!esErrorLegado(mensajeModerno)) {
        if (esErrorContrasena(mensajeModerno)) throw new Error("La contraseña del certificado PKCS#12 es incorrecta");
        throw new Error("El archivo PKCS#12 está corrupto o no tiene un formato válido");
      }
      try {
        return await extraerConOpenssl(ruta, contrasena, true);
      } catch (errorLegacy) {
        const mensajeLegacy = errorLegacy instanceof Error ? errorLegacy.message : "";
        if (esErrorContrasena(mensajeLegacy) || esErrorContrasena(mensajeModerno)) {
          throw new Error("La contraseña del certificado PKCS#12 es incorrecta");
        }
        throw new Error("El archivo PKCS#12 está corrupto, usa un cifrado no soportado o no tiene un formato válido");
      }
    }
  } finally {
    await rm(carpeta, { recursive: true, force: true });
  }
}
