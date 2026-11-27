import type { ConfiguracionEcfPublica } from "./ecf-portal-tipos";
import type { AmbienteEcf } from "./pasos-habilitacion";

export type AmbienteEcfPersistidoLocal = "testecf" | "certecf";

export function claveAmbienteLocal(rnc: string): string {
  const rncLimpio = rnc.replace(/\D/g, "");
  return `medoxigas:ecf:ambiente:${rncLimpio === "" ? "sin-rnc" : rncLimpio}`;
}

function esAmbientePersistidoLocal(valor: string | null): valor is AmbienteEcfPersistidoLocal {
  return valor === "testecf" || valor === "certecf";
}

function almacenamientoLocalNavegador(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function leerAmbientePersistidoLocal(
  rnc: string,
  storage?: Pick<Storage, "getItem"> | null,
): AmbienteEcfPersistidoLocal | null {
  const almacenamiento = storage === undefined ? almacenamientoLocalNavegador() : storage;
  if (almacenamiento === null) return null;
  try {
    const valor = almacenamiento.getItem(claveAmbienteLocal(rnc));
    return esAmbientePersistidoLocal(valor) ? valor : null;
  } catch {
    return null;
  }
}

export function guardarAmbientePersistidoLocal(
  rnc: string,
  ambiente: AmbienteEcf,
  storage?: Pick<Storage, "setItem"> | null,
): void {
  if (ambiente !== "testecf" && ambiente !== "certecf") return;
  const almacenamiento = storage === undefined ? almacenamientoLocalNavegador() : storage;
  if (almacenamiento === null) return;
  try {
    almacenamiento.setItem(claveAmbienteLocal(rnc), ambiente);
  } catch {
    return;
  }
}

export function resolverAmbienteInicial(
  configAmbiente: ConfiguracionEcfPublica["ambiente"] | null | undefined,
  guardadoLocal: AmbienteEcfPersistidoLocal | null,
): AmbienteEcf {
  if (configAmbiente === "ecf") return "produccion";
  if (guardadoLocal !== null) return guardadoLocal;
  if (configAmbiente === "certecf") return "certecf";
  return "testecf";
}
