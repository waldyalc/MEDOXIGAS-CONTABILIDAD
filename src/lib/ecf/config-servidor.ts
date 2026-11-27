import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/lib/supabase/types";

import { cifrarSecretoEcf, descifrarSecretoEcf, leerMetadatosCertificado } from "./firma";
import { leerCertificadoPkcs12 } from "./pkcs12";
import type { AmbienteEcf, MetadatosCertificado, ParCertificadoEcf } from "./tipos";

type ClienteSupabase = SupabaseClient<Database>;

export interface EstadoConfigEcf {
  rnc: string;
  razonSocial: string;
  ambiente: AmbienteEcf;
  activo: boolean;
  dominioBase: string | null;
  certTitular: string | null;
  certNumeroSerie: string | null;
  certValidoHasta: string | null;
  certHuellaSha256: string | null;
  tieneCertificado: boolean;
  claveMaestraConfigurada: boolean;
}

export interface GuardarCertificadoP12Input {
  rnc: string;
  razonSocial: string;
  ambiente?: AmbienteEcf;
  activo?: boolean;
  dominioBase?: string | null;
  p12Buffer?: Buffer;
  contrasena?: string;
}

export type ResultadoGuardarCertificadoP12 = { ok: true; estado: EstadoConfigEcf } | { ok: false; error: string };

export type MotivoCredencialesEcf =
  | "rnc_invalido"
  | "error_consulta"
  | "sin_configuracion"
  | "credenciales_env_incompletas"
  | "sin_clave_maestra"
  | "permiso_denegado"
  | "sin_certificado"
  | "descifrado_fallido"
  | "certificado_invalido";

export type ResultadoCredencialesEcfServidor =
  | {
      ok: true;
      credenciales: ParCertificadoEcf;
      metadatos: MetadatosCertificado;
      ambiente: AmbienteEcf;
      activo: boolean;
      origen: "env" | "base_datos";
    }
  | { ok: false; motivo: MotivoCredencialesEcf; error: string };

interface ConfigEcfFila {
  rnc: string;
  razon_social: string;
  ambiente: string;
  activo: boolean;
  dominio_base: string | null;
  cert_titular: string | null;
  cert_numero_serie: string | null;
  cert_valido_hasta: string | null;
  cert_huella_sha256: string | null;
}

function mensajeError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() !== "" ? error.message : fallback;
}

function ambienteDesdeTexto(valor: string): AmbienteEcf | null {
  return valor === "testecf" || valor === "certecf" || valor === "ecf" ? valor : null;
}

function textoNullable(valor: Json | undefined): string | null {
  return typeof valor === "string" && valor !== "" ? valor : null;
}

function estadoDesdeFila(fila: ConfigEcfFila): EstadoConfigEcf {
  const ambiente = ambienteDesdeTexto(fila.ambiente);
  if (!ambiente) throw new Error(`El ambiente e-CF guardado para ${fila.rnc} no es válido`);
  return {
    rnc: fila.rnc,
    razonSocial: fila.razon_social,
    ambiente,
    activo: fila.activo,
    dominioBase: fila.dominio_base,
    certTitular: fila.cert_titular,
    certNumeroSerie: fila.cert_numero_serie,
    certValidoHasta: fila.cert_valido_hasta,
    certHuellaSha256: fila.cert_huella_sha256,
    tieneCertificado: [fila.cert_titular, fila.cert_numero_serie, fila.cert_valido_hasta, fila.cert_huella_sha256].some(
      (valor) => typeof valor === "string" && valor.trim() !== "",
    ),
    claveMaestraConfigurada: claveCifradoEcf() !== null,
  };
}

function estadoDesdeJson(valor: Json | null): EstadoConfigEcf | null {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) return null;
  if (typeof valor.rnc !== "string" || typeof valor.razon_social !== "string" || typeof valor.ambiente !== "string") {
    return null;
  }
  const ambiente = ambienteDesdeTexto(valor.ambiente);
  if (!ambiente || typeof valor.activo !== "boolean" || typeof valor.tiene_certificado !== "boolean") return null;
  return {
    rnc: valor.rnc,
    razonSocial: valor.razon_social,
    ambiente,
    activo: valor.activo,
    dominioBase: textoNullable(valor.dominio_base),
    certTitular: textoNullable(valor.cert_titular),
    certNumeroSerie: textoNullable(valor.cert_numero_serie),
    certValidoHasta: textoNullable(valor.cert_valido_hasta),
    certHuellaSha256: textoNullable(valor.cert_huella_sha256),
    tieneCertificado: valor.tiene_certificado,
    claveMaestraConfigurada: claveCifradoEcf() !== null,
  };
}

function pemEnv(nombre: string): string | null {
  const valor = process.env[nombre]?.trim();
  return valor ? valor.replace(/\\n/g, "\n") : null;
}

function errorCredenciales(motivo: MotivoCredencialesEcf, error: string): ResultadoCredencialesEcfServidor {
  return { ok: false, motivo, error };
}

export function claveCifradoEcf(): string | null {
  return process.env.ECF_ENCRYPTION_KEY?.trim() || null;
}

export async function leerConfigEcf(supabase: ClienteSupabase, rnc: string): Promise<EstadoConfigEcf | null> {
  const { data, error } = await supabase
    .from("ecf_config")
    .select(
      "rnc, razon_social, ambiente, activo, dominio_base, cert_titular, cert_numero_serie, cert_valido_hasta, cert_huella_sha256",
    )
    .eq("rnc", rnc)
    .maybeSingle<ConfigEcfFila>();
  if (error) throw new Error(error.message);
  return data ? estadoDesdeFila(data) : null;
}

export async function guardarCertificadoP12EnConfig(
  supabase: ClienteSupabase,
  input: GuardarCertificadoP12Input,
): Promise<ResultadoGuardarCertificadoP12> {
  const claveMaestra = claveCifradoEcf();
  if (!claveMaestra) {
    return {
      ok: false,
      error: "Configura ECF_ENCRYPTION_KEY en el entorno del servidor antes de guardar el certificado.",
    };
  }

  const rnc = input.rnc.replace(/\D/g, "");
  const razonSocial = input.razonSocial.trim();
  if (!/^\d{9}(\d{2})?$/.test(rnc)) return { ok: false, error: "El RNC debe tener 9 u 11 dígitos." };
  if (!razonSocial) return { ok: false, error: "La razón social es obligatoria." };
  if ((input.p12Buffer === undefined) !== (input.contrasena === undefined)) {
    return { ok: false, error: "Debes subir el archivo .p12 y su contraseña juntos." };
  }

  let certCifrado: string | null = null;
  let certPassCifrada: string | null = null;
  let certTitular: string | null = null;
  let certNumeroSerie: string | null = null;
  let certValidoHasta: string | null = null;
  let certHuellaSha256: string | null = null;

  if (input.p12Buffer !== undefined && input.contrasena !== undefined) {
    try {
      const leido = await leerCertificadoPkcs12(input.p12Buffer, input.contrasena);
      if (!leido.metadatos.vigente) {
        return { ok: false, error: "El certificado .p12 está vencido o todavía no está vigente." };
      }
      certCifrado = cifrarSecretoEcf(input.p12Buffer.toString("base64"), claveMaestra);
      certPassCifrada = cifrarSecretoEcf(input.contrasena, claveMaestra);
      certTitular = leido.metadatos.titular;
      certNumeroSerie = leido.metadatos.numeroSerie;
      certValidoHasta = leido.metadatos.validoHasta.toISOString();
      certHuellaSha256 = leido.metadatos.huellaSha256;
    } catch (error) {
      return { ok: false, error: `No se pudo leer el certificado .p12: ${mensajeError(error, "archivo inválido")}` };
    }
  }

  const { data, error } = await supabase.rpc("guardar_ecf_certificado", {
    p_rnc: rnc,
    p_razon_social: razonSocial,
    p_ambiente: input.ambiente ?? "testecf",
    p_activo: input.activo ?? false,
    p_dominio_base: input.dominioBase?.trim() ? input.dominioBase.trim() : undefined,
    p_cert_cifrado: certCifrado ?? undefined,
    p_cert_pass_cifrada: certPassCifrada ?? undefined,
    p_cert_titular: certTitular ?? undefined,
    p_cert_numero_serie: certNumeroSerie ?? undefined,
    p_cert_valido_hasta: certValidoHasta ?? undefined,
    p_cert_huella_sha256: certHuellaSha256 ?? undefined,
  });
  if (error) return { ok: false, error: error.message };
  const estado = estadoDesdeJson(data);
  if (!estado) return { ok: false, error: "La RPC guardar_ecf_certificado no devolvió metadatos válidos." };
  return { ok: true, estado };
}

function credencialesDesdeEnv(rnc: string, config: EstadoConfigEcf): ResultadoCredencialesEcfServidor | null {
  const certificadoEnv = pemEnv(`ECF_CERT_PEM_${rnc}`);
  const claveEnv = pemEnv(`ECF_KEY_PEM_${rnc}`);
  if (certificadoEnv && claveEnv) {
    try {
      return {
        ok: true,
        credenciales: { certificadoPem: certificadoEnv, clavePrivadaPem: claveEnv },
        metadatos: leerMetadatosCertificado(certificadoEnv),
        ambiente: config.ambiente,
        activo: config.activo,
        origen: "env",
      };
    } catch {
      return errorCredenciales("certificado_invalido", "El certificado PEM configurado en el entorno no es válido.");
    }
  }
  if (certificadoEnv || claveEnv) {
    return errorCredenciales(
      "credenciales_env_incompletas",
      `Configura tanto ECF_CERT_PEM_${rnc} como ECF_KEY_PEM_${rnc}, o elimina ambas para usar el certificado cifrado.`,
    );
  }
  return null;
}

async function credencialesDesdeBaseDatos(
  supabase: ClienteSupabase,
  rnc: string,
  config: EstadoConfigEcf,
  claveMaestra: string,
): Promise<ResultadoCredencialesEcfServidor> {
  const { data: filas, error } = await supabase.rpc("obtener_ecf_secreto_firma", { p_rnc: rnc });
  if (error) {
    const motivo = error.code === "42501" ? "permiso_denegado" : "error_consulta";
    return errorCredenciales(motivo, error.message);
  }
  const fila = filas?.[0];
  if (!fila) return errorCredenciales("sin_configuracion", "No existe configuración e-CF para el RNC emisor.");
  if (!fila.cert_cifrado || !fila.cert_pass_cifrada) {
    return errorCredenciales("sin_certificado", "La configuración e-CF no tiene certificado cifrado guardado.");
  }

  let blobBase64 = "";
  let contrasena = "";
  try {
    blobBase64 = descifrarSecretoEcf(fila.cert_cifrado, claveMaestra);
    contrasena = descifrarSecretoEcf(fila.cert_pass_cifrada, claveMaestra);
  } catch {
    return errorCredenciales(
      "descifrado_fallido",
      "No se pudo descifrar el certificado: revisa ECF_ENCRYPTION_KEY y la custodia del secreto.",
    );
  }

  try {
    const leido = await leerCertificadoPkcs12(Buffer.from(blobBase64, "base64"), contrasena);
    if (!leido.metadatos.vigente) {
      return errorCredenciales(
        "certificado_invalido",
        "El certificado guardado está vencido o todavía no está vigente.",
      );
    }
    return {
      ok: true,
      credenciales: { certificadoPem: leido.certificadoPem, clavePrivadaPem: leido.clavePrivadaPem },
      metadatos: leido.metadatos,
      ambiente: config.ambiente,
      activo: config.activo,
      origen: "base_datos",
    };
  } catch {
    return errorCredenciales(
      "certificado_invalido",
      "El certificado descifrado no es un PKCS#12 válido o su contraseña no corresponde.",
    );
  }
}

export async function cargarCredencialesEcfServidor(
  supabase: ClienteSupabase,
  rncEntrada: string,
): Promise<ResultadoCredencialesEcfServidor> {
  const rnc = rncEntrada.replace(/\D/g, "");
  if (!/^\d{9}(\d{2})?$/.test(rnc)) {
    return errorCredenciales("rnc_invalido", "El RNC del emisor debe tener 9 u 11 dígitos.");
  }

  let config: EstadoConfigEcf | null;
  try {
    config = await leerConfigEcf(supabase, rnc);
  } catch (error) {
    return errorCredenciales("error_consulta", mensajeError(error, "No se pudo leer la configuración e-CF."));
  }
  if (!config) {
    return errorCredenciales("sin_configuracion", "No existe configuración e-CF para el RNC emisor.");
  }

  const credencialesEnv = credencialesDesdeEnv(rnc, config);
  if (credencialesEnv) return credencialesEnv;

  const claveMaestra = claveCifradoEcf();
  if (!claveMaestra) {
    return errorCredenciales(
      "sin_clave_maestra",
      "Configura ECF_ENCRYPTION_KEY en el entorno del servidor para leer el certificado cifrado.",
    );
  }
  return credencialesDesdeBaseDatos(supabase, rnc, config, claveMaestra);
}
