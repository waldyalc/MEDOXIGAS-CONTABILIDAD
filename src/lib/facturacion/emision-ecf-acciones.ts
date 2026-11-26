"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getRol } from "@/lib/auth/rol";
import { consultarResultadoDgii, enviarEcfDgii, obtenerTokenDgii } from "@/lib/ecf/cliente-dgii";
import { construirUrlQrDgii } from "@/lib/ecf/endpoints";
import { descifrarSecretoEcf, firmarXmlDsig } from "@/lib/ecf/firma";
import { leerCertificadoPkcs12 } from "@/lib/ecf/pkcs12";
import type {
  AmbienteEcf,
  DocumentoEcfInput,
  EstadoDgii,
  ItbisTasaEcf,
  ParCertificadoEcf,
  TipoEcf,
} from "@/lib/ecf/tipos";
import { esElegibleRfce, generarXmlEcf, generarXmlRfce, validarDocumentoEcf } from "@/lib/ecf/xml";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/types";

import { tipoEcfDesdeNcf } from "./emision-ecf";

const ERROR_CONFIG =
  "Configura el certificado digital .p12 y activa el ambiente en Configuración → Facturación electrónica antes de emitir a la DGII.";

export type ResultadoEmisionEcf = { ok: true; estado: EstadoDgii; mensaje?: string } | { ok: false; error: string };

type ClienteSupabase = Awaited<ReturnType<typeof createClient>>;

interface ConfigEcf {
  rnc: string;
  razon_social: string;
  ambiente: string;
  activo: boolean;
  cert_titular: string | null;
  cert_numero_serie: string | null;
  cert_huella_sha256: string | null;
}

function redondear(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

function ambienteEcf(valor: string): AmbienteEcf | null {
  return valor === "testecf" || valor === "certecf" || valor === "ecf" ? valor : null;
}

function serializarJson(valor: unknown): Json {
  return JSON.parse(JSON.stringify(valor)) as Json;
}

function estadoDesdeTexto(valor: string): EstadoDgii {
  const texto = valor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  if (texto.includes("aceptado") && texto.includes("condicional")) return "aceptado_condicional";
  if (texto.includes("aceptado")) return "aceptado";
  if (texto.includes("rechazado")) return "rechazado";
  return "en_proceso";
}

function pemEnv(nombre: string): string | null {
  const valor = process.env[nombre]?.trim();
  return valor ? valor.replace(/\\n/g, "\n") : null;
}

async function cargarCredenciales(supabase: ClienteSupabase, rnc: string): Promise<ParCertificadoEcf | null> {
  const certificadoEnv = pemEnv(`ECF_CERT_PEM_${rnc}`);
  const claveEnv = pemEnv(`ECF_KEY_PEM_${rnc}`);
  if (certificadoEnv && claveEnv) return { certificadoPem: certificadoEnv, clavePrivadaPem: claveEnv };

  const claveMaestra = process.env.ECF_ENCRYPTION_KEY?.trim();
  if (!claveMaestra) return null;
  const { data, error } = await supabase
    .from("ecf_config")
    .select("cert_cifrado, cert_pass_cifrada")
    .eq("rnc", rnc)
    .maybeSingle<{ cert_cifrado: string | null; cert_pass_cifrada: string | null }>();
  if (error || !data?.cert_cifrado || !data.cert_pass_cifrada) return null;

  const blobBase64 = descifrarSecretoEcf(data.cert_cifrado, claveMaestra);
  const contrasena = descifrarSecretoEcf(data.cert_pass_cifrada, claveMaestra);
  const leido = await leerCertificadoPkcs12(Buffer.from(blobBase64, "base64"), contrasena);
  return { certificadoPem: leido.certificadoPem, clavePrivadaPem: leido.clavePrivadaPem };
}

async function getConfigEcf(supabase: ClienteSupabase, rnc: string): Promise<ConfigEcf | null> {
  const { data, error } = await supabase
    .from("ecf_config")
    .select("rnc, razon_social, ambiente, activo, cert_titular, cert_numero_serie, cert_huella_sha256")
    .eq("rnc", rnc)
    .maybeSingle<ConfigEcf>();
  if (error) throw new Error(error.message);
  return data;
}

function fechaHoraRdDgii(): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santo_Domingo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const valor = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value ?? "00";
  return `${valor("day")}-${valor("month")}-${valor("year")} ${valor("hour")}:${valor("minute")}:${valor("second")}`;
}

function tasaItbisEcf(tasa: number): ItbisTasaEcf {
  if (tasa === 18) return 18;
  if (tasa === 16) return 16;
  return 0;
}

function tipoPagoEcf(pagado: number, total: number): "1" | "2" | "3" {
  if (pagado >= total) return "1";
  if (pagado <= 0) return "2";
  return "3";
}

function indicadorItbis(tasa: number): "1" | "2" | "4" | null {
  if (tasa === 18) return "1";
  if (tasa === 16) return "2";
  if (tasa === 0) return "4";
  return null;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: La adaptación fiscal valida líneas, contacto, empresa y numeración antes de construir el XML; dividirla dispersaría invariantes que deben evaluarse juntas.
async function construirDocumentoEcf(
  supabase: ClienteSupabase,
  facturaId: string,
): Promise<{ documento: DocumentoEcfInput; tipo: TipoEcf; rncEmisor: string } | { error: string }> {
  const [facturaRes, lineasRes] = await Promise.all([
    supabase
      .from("facturas")
      .select(
        "id, ncf, tipo_comprobante, contacto_id, fecha, total, pagado, credito, retenido, otros_impuestos, propina, estado",
      )
      .eq("id", facturaId)
      .maybeSingle<{
        id: string;
        ncf: string | null;
        tipo_comprobante: string;
        contacto_id: string;
        fecha: string;
        total: number;
        pagado: number;
        credito: number;
        retenido: number;
        otros_impuestos: number;
        propina: number;
        estado: string;
      }>(),
    supabase
      .from("factura_lineas")
      .select("descripcion, cantidad, precio, descuento_pct, itbis_tasa, subtotal, itbis")
      .eq("factura_id", facturaId)
      .order("id")
      .returns<
        {
          descripcion: string;
          cantidad: number;
          precio: number;
          descuento_pct: number;
          itbis_tasa: number;
          subtotal: number;
          itbis: number;
        }[]
      >(),
  ]);
  if (facturaRes.error) return { error: facturaRes.error.message };
  if (lineasRes.error) return { error: lineasRes.error.message };
  const factura = facturaRes.data;
  if (!factura) return { error: "La factura no existe." };
  if (factura.estado === "anulada") return { error: "Una factura anulada no se puede emitir a la DGII." };
  const tipo = tipoEcfDesdeNcf(factura.ncf);
  if (!factura.ncf || !tipo || !/^E(31|32|33|34|41|43|44|45|46|47)\d{10}$/.test(factura.ncf)) {
    return { error: "La factura no tiene un e-NCF electrónico válido de 13 caracteres." };
  }
  if ((lineasRes.data ?? []).length === 0) return { error: "La factura no tiene líneas para construir el XML e-CF." };
  if (factura.otros_impuestos !== 0 || factura.propina !== 0) {
    return { error: "Esta factura tiene otros impuestos o propina; su representación e-CF aún no está implementada." };
  }

  const [contactoRes, empresaRes, numeracionesRes] = await Promise.all([
    supabase
      .from("contactos")
      .select("nombre, rnc_cedula")
      .eq("id", factura.contacto_id)
      .maybeSingle<{ nombre: string; rnc_cedula: string | null }>(),
    supabase
      .from("empresa")
      .select("nombre, rnc, direccion, correo")
      .eq("id", 1)
      .maybeSingle<{ nombre: string; rnc: string | null; direccion: string | null; correo: string | null }>(),
    supabase
      .from("numeraciones")
      .select("prefijo, vence, siguiente")
      .eq("tipo_comprobante", factura.tipo_comprobante)
      .returns<{ prefijo: string; vence: string | null; siguiente: number }[]>(),
  ]);
  if (contactoRes.error) return { error: contactoRes.error.message };
  if (empresaRes.error) return { error: empresaRes.error.message };
  if (numeracionesRes.error) return { error: numeracionesRes.error.message };
  const empresa = empresaRes.data;
  const contacto = contactoRes.data;
  const rncEmisor = empresa?.rnc?.replace(/\D/g, "") ?? "";
  if (!empresa || !contacto || !/^\d{9}(\d{2})?$/.test(rncEmisor)) {
    return { error: "Completa el RNC y los datos fiscales de la empresa antes de emitir." };
  }
  if (!empresa.direccion?.trim()) return { error: "Completa la dirección fiscal de la empresa antes de emitir." };

  const numeracion = (numeracionesRes.data ?? []).find((fila) => factura.ncf?.startsWith(fila.prefijo));
  if (!numeracion?.vence) return { error: "La numeración electrónica no tiene fecha de vencimiento configurada." };

  const lineas = (lineasRes.data ?? []).map((linea, indice) => {
    const indicador = indicadorItbis(linea.itbis_tasa);
    if (!indicador) throw new Error(`La línea ${indice + 1} usa una tasa de ITBIS no soportada por e-CF.`);
    const itbisTasa = tasaItbisEcf(linea.itbis_tasa);
    const bruto = redondear(linea.cantidad * linea.precio);
    return {
      numeroLinea: indice + 1,
      indicadorFacturacion: indicador,
      nombreItem: linea.descripcion || `Ítem ${indice + 1}`,
      cantidad: linea.cantidad,
      precioUnitario: linea.precio,
      descuento: redondear(Math.max(0, bruto - linea.subtotal)),
      itbisTasa,
      montoItem: linea.subtotal,
      indicadorBienoServicio: "1" as const,
    };
  });

  const suma = (condicion: (tasa: number) => boolean, campo: "subtotal" | "itbis") =>
    redondear(
      (lineasRes.data ?? [])
        .filter((linea) => condicion(linea.itbis_tasa))
        .reduce((total, linea) => total + linea[campo], 0),
    );
  const gravadoI1 = suma((tasa) => tasa === 18, "subtotal");
  const gravadoI2 = suma((tasa) => tasa === 16, "subtotal");
  const exento = suma((tasa) => tasa !== 18 && tasa !== 16, "subtotal");
  const itbis1 = suma((tasa) => tasa === 18, "itbis");
  const itbis2 = suma((tasa) => tasa === 16, "itbis");
  const rncComprador = contacto.rnc_cedula?.replace(/\D/g, "") ?? "";

  return {
    tipo,
    rncEmisor,
    documento: {
      emisor: {
        rnc: rncEmisor,
        razonSocial: empresa.nombre,
        direccion: empresa.direccion,
        ...(empresa.correo ? { correo: empresa.correo } : {}),
      },
      comprador: {
        ...(rncComprador ? { rnc: rncComprador } : {}),
        razonSocial: contacto.nombre,
      },
      comprobante: {
        tipo,
        encf: factura.ncf,
        fechaEmision: factura.fecha,
        fechaVencimientoSecuencia: numeracion.vence,
        tipoIngresos: "01",
        tipoPago: tipoPagoEcf(factura.pagado, factura.total),
        indicadorMontoGravado: "0",
        fechaHoraFirma: fechaHoraRdDgii(),
      },
      lineas,
      totales: {
        montoGravadoI1: gravadoI1,
        montoGravadoI2: gravadoI2,
        montoGravadoI3: 0,
        montoExento: exento,
        totalItbis1: itbis1,
        totalItbis2: itbis2,
        totalItbis3: 0,
        totalItbis: redondear(itbis1 + itbis2),
        montoTotal: factura.total,
      },
    },
  };
}

async function actualizarEnvio(
  supabase: ClienteSupabase,
  id: string,
  cambios: Database["public"]["Tables"]["ecf_envios"]["Update"],
): Promise<void> {
  const { error } = await supabase.from("ecf_envios").update(cambios).eq("id", id);
  if (error) throw new Error(error.message);
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: La emisión debe coordinar validación fiscal, firma, RFCE, persistencia y respuesta DGII en una única transacción lógica honesta.
export async function emitirFacturaEcfAction(facturaId: string): Promise<ResultadoEmisionEcf> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") return { ok: false, error: "No tienes permiso para emitir comprobantes." };
  if (!z.uuid().safeParse(facturaId).success) return { ok: false, error: "Factura inválida." };

  const supabase = await createClient();
  let envioIdPendiente: string | null = null;
  try {
    const construido = await construirDocumentoEcf(supabase, facturaId);
    if ("error" in construido) return { ok: false, error: construido.error };
    const { documento, rncEmisor } = construido;
    const config = await getConfigEcf(supabase, rncEmisor);
    if (!config) return { ok: false, error: ERROR_CONFIG };
    const ambiente = ambienteEcf(config.ambiente);
    const certificadoConfigurado = [config.cert_huella_sha256, config.cert_numero_serie, config.cert_titular].some(
      (valor) => Boolean(valor),
    );
    if (!config.activo || !ambiente || !certificadoConfigurado) return { ok: false, error: ERROR_CONFIG };

    const validacion = validarDocumentoEcf(documento);
    if (!validacion.ok) return { ok: false, error: `Documento e-CF inválido: ${validacion.errores.join("; ")}` };

    const credenciales = await cargarCredenciales(supabase, rncEmisor);
    if (!credenciales) {
      return {
        ok: false,
        error:
          "El certificado está registrado, pero el servidor no puede leer sus secretos cifrados o las variables PEM del RNC. Revisa la custodia del certificado antes de emitir.",
      };
    }

    const { data: existente } = await supabase
      .from("ecf_envios")
      .select("id, intentos, estado")
      .eq("rnc_emisor", rncEmisor)
      .eq("ambiente", ambiente)
      .eq("encf", documento.comprobante.encf)
      .maybeSingle<{ id: string; intentos: number; estado: EstadoDgii }>();
    if (existente?.estado === "aceptado" || existente?.estado === "aceptado_condicional") {
      return { ok: true, estado: existente.estado, mensaje: "El comprobante ya está aceptado por la DGII." };
    }

    const xml = generarXmlEcf(documento);
    const firma = firmarXmlDsig(xml, credenciales.clavePrivadaPem, credenciales.certificadoPem);
    const rfce = esElegibleRfce(documento);
    let xmlEnvio = firma.xmlFirmado;
    let xmlRfce: string | null = null;
    if (rfce) {
      const rfceFirmado = firmarXmlDsig(
        generarXmlRfce(documento, firma.codigoSeguridad),
        credenciales.clavePrivadaPem,
        credenciales.certificadoPem,
      );
      xmlEnvio = rfceFirmado.xmlFirmado;
      xmlRfce = rfceFirmado.xmlFirmado;
    }

    const base = {
      rnc_emisor: rncEmisor,
      documento_tipo: "factura",
      documento_id: facturaId,
      tipo_ecf: documento.comprobante.tipo,
      encf: documento.comprobante.encf,
      es_rfce: rfce,
      ambiente,
      estado: "en_proceso",
      codigo_seguridad: firma.codigoSeguridad,
      fecha_hora_firma: documento.comprobante.fechaHoraFirma ?? null,
      xml_firmado: firma.xmlFirmado,
      xml_rfce: xmlRfce,
      mensajes: [],
      intentos: (existente?.intentos ?? 0) + 1,
      ultimo_intento_at: new Date().toISOString(),
    };
    let envioId = existente?.id ?? "";
    if (envioId) {
      await actualizarEnvio(supabase, envioId, base);
    } else {
      const { data, error } = await supabase.from("ecf_envios").insert(base).select("id").single<{ id: string }>();
      if (error) throw new Error(error.message);
      envioId = data.id;
    }
    envioIdPendiente = envioId;

    const token = await obtenerTokenDgii({
      ambiente,
      clavePrivadaPem: credenciales.clavePrivadaPem,
      certificadoPem: credenciales.certificadoPem,
      confirmarProduccion: true,
    });
    const nombreArchivo = `${rncEmisor}${documento.comprobante.encf}.xml`;
    const enviado = await enviarEcfDgii({
      ambiente,
      token: token.token,
      nombreArchivo,
      xmlFirmado: xmlEnvio,
      esRfce: rfce,
      confirmarProduccion: true,
    });

    let estado: EstadoDgii = rfce ? estadoDesdeTexto(enviado.estado) : "en_proceso";
    let mensajes = enviado.mensajes;
    let respuesta: Record<string, unknown> = { recepcion: enviado };
    if (!rfce && enviado.trackId) {
      const consulta = await consultarResultadoDgii({
        ambiente,
        token: token.token,
        trackId: enviado.trackId,
        confirmarProduccion: true,
      });
      estado = consulta.estado;
      mensajes = consulta.mensajes.length > 0 ? consulta.mensajes : mensajes;
      respuesta = { recepcion: enviado, consulta };
    }

    const fechaFirma = documento.comprobante.fechaHoraFirma ?? "";
    const urlQr =
      estado === "aceptado" || estado === "aceptado_condicional"
        ? construirUrlQrDgii({
            ambiente,
            rncEmisor,
            rncComprador: documento.comprador.rnc ?? "",
            encf: documento.comprobante.encf,
            fechaEmision: documento.comprobante.fechaEmision,
            montoTotal: documento.totales.montoTotal.toFixed(2),
            fechaFirma,
            codigoSeguridad: firma.codigoSeguridad,
            esRfce: rfce,
          })
        : null;
    await actualizarEnvio(supabase, envioId, {
      estado,
      track_id: enviado.trackId ?? null,
      mensajes,
      respuesta_dgii: serializarJson(respuesta),
      url_qr: urlQr,
      ultimo_intento_at: new Date().toISOString(),
    });

    revalidatePath("/dashboard/facturacion");
    revalidatePath(`/dashboard/facturacion/${facturaId}`);
    return { ok: true, estado };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "No se pudo emitir el comprobante a la DGII.";
    if (envioIdPendiente) {
      await actualizarEnvio(supabase, envioIdPendiente, {
        estado: "error_red",
        mensajes: [mensaje],
        ultimo_intento_at: new Date().toISOString(),
      }).catch(() => undefined);
    }
    return { ok: false, error: mensaje };
  }
}

export async function consultarEstadoFacturaEcfAction(facturaId: string): Promise<ResultadoEmisionEcf> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") return { ok: false, error: "No tienes permiso para consultar la DGII." };
  if (!z.uuid().safeParse(facturaId).success) return { ok: false, error: "Factura inválida." };

  const supabase = await createClient();
  try {
    const { data: envio, error } = await supabase
      .from("ecf_envios")
      .select("id, rnc_emisor, encf, es_rfce, ambiente, estado, track_id")
      .eq("documento_tipo", "factura")
      .eq("documento_id", facturaId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<{
        id: string;
        rnc_emisor: string;
        encf: string;
        es_rfce: boolean;
        ambiente: AmbienteEcf;
        estado: EstadoDgii;
        track_id: string | null;
      }>();
    if (error) return { ok: false, error: error.message };
    if (!envio?.track_id) return { ok: false, error: "Este comprobante aún no tiene TrackId de la DGII." };
    const credenciales = await cargarCredenciales(supabase, envio.rnc_emisor);
    if (!credenciales) return { ok: false, error: "No hay credenciales de firma disponibles para consultar la DGII." };
    const token = await obtenerTokenDgii({
      ambiente: envio.ambiente,
      clavePrivadaPem: credenciales.clavePrivadaPem,
      certificadoPem: credenciales.certificadoPem,
      confirmarProduccion: true,
    });
    const consulta = await consultarResultadoDgii({
      ambiente: envio.ambiente,
      token: token.token,
      trackId: envio.track_id,
      confirmarProduccion: true,
    });
    await actualizarEnvio(supabase, envio.id, {
      estado: consulta.estado,
      mensajes: consulta.mensajes,
      respuesta_dgii: serializarJson(consulta),
      ultimo_intento_at: new Date().toISOString(),
    });
    revalidatePath("/dashboard/facturacion");
    revalidatePath(`/dashboard/facturacion/${facturaId}`);
    return { ok: true, estado: consulta.estado };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo consultar el estado en la DGII." };
  }
}
