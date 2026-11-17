"use server";

import { consultarDgii, type DatosContribuyenteDgii, type TipoDocumentoDgii } from "./consulta";

export type ResultadoBusquedaDgii = { ok: true; datos: DatosContribuyenteDgii } | { ok: false; error: string };

const MENSAJE_INVALIDO: Record<TipoDocumentoDgii, string> = {
  rnc: "El RNC debe tener 9 dígitos.",
  cedula: "La cédula debe tener 11 dígitos.",
};

const MENSAJE_NO_ENCONTRADO: Record<TipoDocumentoDgii, string> = {
  rnc: "No se encontró ese RNC en la DGII.",
  cedula: "No se encontró esa cédula en la DGII.",
};

function esTipoValido(tipo: string): tipo is TipoDocumentoDgii {
  return tipo === "rnc" || tipo === "cedula";
}

/**
 * Consulta el nombre del contribuyente en la DGII. Solo lee: no guarda nada.
 * Devuelve siempre un objeto serializable para el cliente.
 */
export async function buscarContribuyenteDgii(numero: string, tipo: string): Promise<ResultadoBusquedaDgii> {
  if (!esTipoValido(tipo)) {
    return { ok: false, error: "La DGII solo consulta RNC y cédula. Escribe el número a mano." };
  }

  const texto = typeof numero === "string" ? numero.trim() : "";
  if (texto === "") {
    return { ok: false, error: tipo === "rnc" ? "Escribe el RNC de 9 dígitos." : "Escribe la cédula de 11 dígitos." };
  }
  if (texto.length > 40) return { ok: false, error: "El número no es válido." };

  const resultado = await consultarDgii(tipo, texto);
  if (resultado.ok) return resultado;

  if (resultado.error === "documento_invalido") return { ok: false, error: MENSAJE_INVALIDO[tipo] };
  if (resultado.error === "no_encontrado") return { ok: false, error: MENSAJE_NO_ENCONTRADO[tipo] };
  if (resultado.error === "sin_respuesta") {
    return { ok: false, error: "La DGII no respondió a tiempo. Intenta de nuevo o escríbelo a mano." };
  }
  return { ok: false, error: "No se pudo consultar la DGII. Intenta de nuevo o escríbelo a mano." };
}
