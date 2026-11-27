import { getRol } from "@/lib/auth/rol";
import { cargarCredencialesEcfServidor } from "@/lib/ecf/config-servidor";
import { firmarXmlDsig, verificarFirmaXmlDsig } from "@/lib/ecf/firma";
import { leerCertificadoPkcs12 } from "@/lib/ecf/pkcs12";
import type { ParCertificadoEcf } from "@/lib/ecf/tipos";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const TAMANO_MAXIMO_ARCHIVO = 2 * 1024 * 1024;

function jsonError(mensaje: string, status: number) {
  return Response.json({ ok: false, error: mensaje }, { status });
}

function normalizarRnc(valor: string | null): string {
  return valor?.replace(/\D/g, "") ?? "";
}

function rncValido(rnc: string): boolean {
  return /^\d{9}(\d{2})?$/.test(rnc);
}

function textoForm(form: FormData, nombre: string): string {
  const valor = form.get(nombre);
  return typeof valor === "string" ? valor : "";
}

function archivoForm(form: FormData, nombre: string): File | null {
  const valor = form.get(nombre);
  if (typeof valor !== "object" || valor === null) return null;
  if (!("arrayBuffer" in valor) || !("name" in valor) || !("size" in valor)) return null;
  const archivo = valor as File;
  return archivo.name !== "" && archivo.size > 0 ? archivo : null;
}

function nombreDescargaFirmado(nombreOriginal: string): string {
  const sinExtension = nombreOriginal.replace(/\.xml$/i, "");
  const seguro = sinExtension.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^_+|_+$/g, "") || "postulacion-dgii";
  return `${seguro}.xml`;
}

async function resolverCredencialesFirma(
  rnc: string,
  archivoP12: File | null,
  contrasenaP12: string,
): Promise<{ ok: true; credenciales: ParCertificadoEcf } | { ok: false; error: string; status: number }> {
  if (archivoP12) {
    const nombre = archivoP12.name.trim().toLowerCase();
    if (!nombre.endsWith(".p12") && !nombre.endsWith(".pfx")) {
      return { ok: false, error: "El certificado digital debe ser un archivo .p12 o .pfx.", status: 400 };
    }
    if (archivoP12.size > TAMANO_MAXIMO_ARCHIVO) {
      return { ok: false, error: "El certificado digital no puede superar 2 MB.", status: 400 };
    }
    if (contrasenaP12.length === 0) {
      return { ok: false, error: "Escribe la contraseña del certificado para firmar el XML.", status: 400 };
    }
    try {
      const leido = await leerCertificadoPkcs12(Buffer.from(await archivoP12.arrayBuffer()), contrasenaP12);
      return {
        ok: true,
        credenciales: { clavePrivadaPem: leido.clavePrivadaPem, certificadoPem: leido.certificadoPem },
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "No se pudo leer el certificado .p12.",
        status: 400,
      };
    }
  }

  const supabase = await createClient();
  const resultado = await cargarCredencialesEcfServidor(supabase, rnc);
  if (!resultado.ok) {
    const status = resultado.motivo === "sin_clave_maestra" ? 500 : 400;
    return {
      ok: false,
      error: `${resultado.error} Guarda primero tu certificado .p12 en el Paso 1 o selecciónalo aquí.`,
      status,
    };
  }
  return { ok: true, credenciales: resultado.credenciales };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: valida multipart, XML de postulación, credenciales reales y firma XMLDSig verificada
export async function POST(request: Request) {
  const rol = await getRol();
  if (!rol) return jsonError("Debes iniciar sesión para firmar archivos XML.", 401);
  if (rol !== "admin") return jsonError("Solo un administrador puede firmar archivos XML de la DGII.", 403);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("El cuerpo debe ser multipart/form-data.", 400);
  }

  const rnc = normalizarRnc(textoForm(form, "rnc"));
  const archivoXml = archivoForm(form, "archivoXml");
  const archivoP12 = archivoForm(form, "certificadoP12");
  const contrasenaP12 = textoForm(form, "contrasenaP12");

  if (!rncValido(rnc)) return jsonError("El RNC del emisor debe tener 9 u 11 dígitos.", 400);
  if (!archivoXml) return jsonError("Selecciona el archivo .xml descargado de la DGII.", 400);
  if (!archivoXml.name.trim().toLowerCase().endsWith(".xml")) {
    return jsonError("El archivo de postulación debe tener extensión .xml.", 400);
  }
  if (archivoXml.size > TAMANO_MAXIMO_ARCHIVO) {
    return jsonError("El archivo XML no puede superar 2 MB.", 400);
  }

  const xmlOriginal = Buffer.from(await archivoXml.arrayBuffer())
    .toString("utf8")
    .replace(/^\uFEFF/, "")
    .trim();
  if (!xmlOriginal.includes("<") || !xmlOriginal.includes("</")) {
    return jsonError("El archivo subido no parece ser un XML válido.", 400);
  }
  if (/<(?:[A-Za-z0-9_-]+:)?Signature[\s>]/.test(xmlOriginal)) {
    return jsonError(
      "Este archivo XML ya contiene una firma digital. Sube el XML original sin firmar de la DGII.",
      400,
    );
  }

  const credenciales = await resolverCredencialesFirma(rnc, archivoP12, contrasenaP12);
  if (!credenciales.ok) return jsonError(credenciales.error, credenciales.status);

  try {
    const firma = firmarXmlDsig(
      xmlOriginal,
      credenciales.credenciales.clavePrivadaPem,
      credenciales.credenciales.certificadoPem,
    );
    const verificacion = verificarFirmaXmlDsig(firma.xmlFirmado);
    if (!verificacion.valida) {
      return jsonError(`La verificación local de la firma falló: ${verificacion.motivo ?? "error desconocido"}`, 500);
    }

    const nombreSalida = nombreDescargaFirmado(archivoXml.name);
    return new Response(firma.xmlFirmado, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nombreSalida}"`,
        "Cache-Control": "private, no-store",
        "X-Ecf-Codigo-Seguridad": firma.codigoSeguridad,
      },
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No se pudo firmar el archivo XML.", 400);
  }
}
