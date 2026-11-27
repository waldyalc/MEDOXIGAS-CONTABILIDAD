import {
  type ConfiguracionEcfPublica,
  configuracionEcfPublicaDesdeFila,
  type FilaConfigEcf,
} from "@/app/(main)/dashboard/configuracion/facturacion-electronica/_components/ecf-portal-tipos";
import { getRol } from "@/lib/auth/rol";
import { cifrarSecretoEcf } from "@/lib/ecf/firma";
import { leerCertificadoPkcs12 } from "@/lib/ecf/pkcs12";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export const runtime = "nodejs";

const COLUMNAS_CONFIG_PUBLICA =
  "rnc, razon_social, ambiente, activo, dominio_base, cert_titular, cert_numero_serie, cert_valido_hasta, cert_huella_sha256";
const TAMANO_MAXIMO_CERTIFICADO = 2 * 1024 * 1024;

type ClienteSupabase = Awaited<ReturnType<typeof createClient>>;

function jsonError(mensaje: string, status: number) {
  return Response.json({ ok: false, error: mensaje }, { status });
}

function normalizarRnc(valor: string | null): string {
  return valor?.replace(/\D/g, "") ?? "";
}

function rncValido(rnc: string): boolean {
  return /^\d{9}(\d{2})?$/.test(rnc);
}

function nombrePkcs12Valido(nombre: string): boolean {
  const limpio = nombre.trim().toLowerCase();
  return limpio.endsWith(".p12") || limpio.endsWith(".pfx");
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

async function leerConfigPublica(
  supabase: ClienteSupabase,
  rnc: string,
): Promise<{ config: ConfiguracionEcfPublica | null; error: string | null }> {
  const { data, error } = await supabase
    .from("ecf_config")
    .select(COLUMNAS_CONFIG_PUBLICA)
    .eq("rnc", rnc)
    .maybeSingle<FilaConfigEcf>();
  if (error) return { config: null, error: error.message };
  return { config: data ? configuracionEcfPublicaDesdeFila(data) : null, error: null };
}

function claveMaestraConfigurada(): boolean {
  return Boolean(process.env.ECF_ENCRYPTION_KEY?.trim());
}

export async function GET(request: Request) {
  const rol = await getRol();
  if (!rol) return jsonError("Debes iniciar sesión para consultar la configuración e-CF.", 401);
  if (rol !== "admin" && rol !== "contador") {
    return jsonError("Solo administradores y contadores pueden consultar la configuración e-CF.", 403);
  }

  const rnc = normalizarRnc(new URL(request.url).searchParams.get("rnc"));
  if (!rncValido(rnc)) return jsonError("El parámetro rnc debe tener 9 u 11 dígitos.", 400);

  const supabase = await createClient();
  const resultado = await leerConfigPublica(supabase, rnc);
  if (resultado.error) return jsonError(`No se pudo leer la configuración e-CF: ${resultado.error}`, 500);
  return Response.json({ ok: true, config: resultado.config, claveMaestraConfigurada: claveMaestraConfigurada() });
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: valida multipart, certificado real, cifrado y persistencia multi-RNC sin exponer secretos
export async function POST(request: Request) {
  const rol = await getRol();
  if (!rol) return jsonError("Debes iniciar sesión para guardar el certificado e-CF.", 401);
  if (rol !== "admin") return jsonError("Solo un administrador puede guardar o activar el certificado e-CF.", 403);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("El cuerpo debe ser multipart/form-data.", 400);
  }

  const rnc = normalizarRnc(textoForm(form, "rnc"));
  const razonSocial = textoForm(form, "razonSocial").trim();
  const ambiente = textoForm(form, "ambiente").trim();
  const activo = textoForm(form, "activo") === "true";
  const dominioBaseTexto = textoForm(form, "dominioBase").trim();
  const contrasena = textoForm(form, "contrasena");
  const archivo = archivoForm(form, "archivo");

  if (!rncValido(rnc)) return jsonError("El RNC del emisor debe tener 9 u 11 dígitos.", 400);
  if (razonSocial === "") return jsonError("La razón social del emisor es obligatoria.", 400);
  if (ambiente !== "testecf" && ambiente !== "certecf" && ambiente !== "ecf") {
    return jsonError("El ambiente debe ser testecf, certecf o ecf.", 400);
  }
  if (archivo && !nombrePkcs12Valido(archivo.name)) {
    return jsonError("El certificado digital debe ser un archivo .p12 o .pfx.", 400);
  }
  if (archivo && archivo.size > TAMANO_MAXIMO_CERTIFICADO) {
    return jsonError("El certificado digital no puede superar 2 MB.", 400);
  }
  if (archivo && contrasena.length === 0) {
    return jsonError("La contraseña del certificado es obligatoria para validarlo y guardarlo.", 400);
  }

  const supabase = await createClient();
  const insertar: Database["public"]["Tables"]["ecf_config"]["Insert"] = {
    rnc,
    razon_social: razonSocial,
    ambiente,
    activo,
    dominio_base: dominioBaseTexto === "" ? null : dominioBaseTexto,
  };

  const { data: claimsData } = await supabase.auth.getClaims();
  if (claimsData?.claims.sub) insertar.updated_by = claimsData.claims.sub;

  if (archivo) {
    if (!claveMaestraConfigurada()) {
      return jsonError(
        "Falta la variable de entorno ECF_ENCRYPTION_KEY en el servidor para cifrar el certificado.",
        500,
      );
    }
    const claveMaestra = process.env.ECF_ENCRYPTION_KEY?.trim() ?? "";
    let leido: Awaited<ReturnType<typeof leerCertificadoPkcs12>>;
    try {
      const buffer = Buffer.from(await archivo.arrayBuffer());
      leido = await leerCertificadoPkcs12(buffer, contrasena);
      insertar.cert_cifrado = cifrarSecretoEcf(buffer.toString("base64"), claveMaestra);
      insertar.cert_pass_cifrada = cifrarSecretoEcf(contrasena, claveMaestra);
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "El certificado PKCS#12 no pudo validarse.", 400);
    }
    insertar.cert_titular = leido.metadatos.titular;
    insertar.cert_numero_serie = leido.metadatos.numeroSerie;
    insertar.cert_valido_hasta = leido.metadatos.validoHasta.toISOString();
    insertar.cert_huella_sha256 = leido.metadatos.huellaSha256;
  }

  const { error } = await supabase.from("ecf_config").upsert(insertar, { onConflict: "rnc" });
  if (error) return jsonError(`No se pudo guardar la configuración e-CF: ${error.message}`, 500);

  const resultado = await leerConfigPublica(supabase, rnc);
  if (resultado.error) {
    return jsonError(`El certificado se guardó, pero no se pudieron leer sus metadatos: ${resultado.error}`, 500);
  }
  return Response.json({ ok: true, config: resultado.config, claveMaestraConfigurada: claveMaestraConfigurada() });
}
