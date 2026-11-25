import type { TipoIdentificacion } from "@/lib/contactos/contacto-rapido";
import { type ContactoTipo, type DatosContacto, esquemaContacto, normalizarBusqueda } from "@/lib/contactos/contactos";
import { createClient } from "@/lib/supabase/client";

import { conBloqueoOffline, guardarOffline, leerOffline } from "./almacen-offline";

/**
 * Clientes del POS sin conexión.
 *
 * La lista de clientes vive completa en IndexedDB (`store "contactos"`) y se
 * filtra en memoria: buscar no pide nada al servidor. Un cliente creado sin
 * red entra a una cola propia; antes de subir una venta que lo usa se
 * sincroniza y su `tempId` se reescribe por el UUID real, para que la RPC
 * nunca falle con «contacto no encontrado».
 */

/** Campos que el diálogo rápido entrega para guardar un cliente en el dispositivo. */
export interface DatosContactoRapidoOffline {
  tipo: ContactoTipo;
  tipo_identificacion: TipoIdentificacion | null;
  rnc_cedula: string | null;
  nombre: string;
  municipio_provincia: string | null;
  direccion: string | null;
  correo: string | null;
  telefono: string | null;
}

/** Cliente recién creado en el dispositivo, listo para seleccionar en la venta. */
export interface ContactoOfflineCreado {
  id: string;
  nombre: string;
  rnc_cedula: string | null;
  direccion: string | null;
  telefono: string | null;
}

export interface ContactoPendienteOffline {
  tempId: string;
  payload: DatosContacto;
  creadoEn: string;
}

export type ResultadoSincronizacionContactos =
  | { ok: true; sincronizados: number }
  | { ok: false; transitorio: boolean; error: string };

export type ResolucionContactoOffline =
  | { estado: "resuelto"; id: string }
  | { estado: "pendiente" }
  | { estado: "original"; id: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SIN_ALMACEN = "Este navegador no puede guardar clientes sin conexión.";
const SIN_LEER_PENDIENTES = "No se pudieron leer los clientes pendientes de este dispositivo.";
const SIN_CONEXION = "No se pudo preparar la conexión para subir los clientes nuevos.";
const SIN_CLIENTE_CREADO = "El servidor no devolvió el cliente nuevo. Quedó pendiente en este dispositivo.";

function clavePendientes(ambito: string): string {
  return `${ambito}/contactos-pendientes`;
}

function claveMapa(ambito: string): string {
  return `${ambito}/contactos-mapa`;
}

function hayAlmacenLocal(): boolean {
  return typeof indexedDB !== "undefined";
}

function normalizarRnc(valor: string | null | undefined): string {
  return (valor ?? "").replace(/\D/g, "");
}

/**
 * Filtro local de clientes (0 ms): nombre o RNC/cédula, sin acentos ni
 * mayúsculas. Al buscar un RNC se ignoran guiones y espacios en ambos lados.
 */
export function filtrarContactosLocal<T extends { nombre: string; rnc_cedula: string | null }>(
  contactos: readonly T[],
  consulta: string,
  limite = 50,
): T[] {
  const termino = normalizarBusqueda(consulta);
  if (termino === "") return contactos.slice(0, limite);

  const digitos = termino.replace(/\D/g, "");
  return contactos
    .filter((contacto) => {
      if (normalizarBusqueda(contacto.nombre).includes(termino)) return true;
      if (digitos === "") return false;
      const rnc = normalizarRnc(contacto.rnc_cedula);
      return rnc !== "" && rnc.includes(digitos);
    })
    .slice(0, limite);
}

async function leerPendientes(ambito: string): Promise<ContactoPendienteOffline[]> {
  const guardados = await leerOffline<ContactoPendienteOffline[]>("config", clavePendientes(ambito));
  return Array.isArray(guardados) ? guardados : [];
}

async function leerMapa(ambito: string): Promise<Record<string, string>> {
  const guardado = await leerOffline<Record<string, string>>("config", claveMapa(ambito));
  return guardado !== undefined && typeof guardado === "object" && !Array.isArray(guardado) ? guardado : {};
}

/**
 * Guarda un cliente nuevo en este dispositivo, con su `tempId` local, para
 * poder venderle sin conexión. Valida con el mismo esquema que la server
 * action para que al sincronizar la RPC reciba datos limpios.
 */
export async function guardarContactoOffline(
  ambito: string,
  datos: DatosContactoRapidoOffline,
): Promise<ContactoOfflineCreado> {
  if (!hayAlmacenLocal()) throw new Error(SIN_ALMACEN);

  const parseo = esquemaContacto.safeParse(datos);
  if (!parseo.success) throw new Error(parseo.error.issues[0]?.message ?? "Los datos del cliente no son válidos.");

  const tempId = crypto.randomUUID();
  const pendiente: ContactoPendienteOffline = {
    tempId,
    payload: parseo.data,
    creadoEn: new Date().toISOString(),
  };

  const clave = clavePendientes(ambito);
  await conBloqueoOffline(clave, async () => {
    const actuales = await leerPendientes(ambito);
    await guardarOffline("config", clave, [...actuales, pendiente]);
  });

  return {
    id: tempId,
    nombre: parseo.data.nombre,
    rnc_cedula: parseo.data.rnc_cedula,
    direccion: parseo.data.direccion,
    telefono: parseo.data.telefono,
  };
}

function errorTransitorioContacto(codigo: string | null | undefined): boolean {
  if (!codigo) return true;
  return (
    codigo.startsWith("08") ||
    codigo.startsWith("53") ||
    codigo.startsWith("PGRST00") ||
    codigo === "57P01" ||
    codigo === "57P02" ||
    codigo === "57P03" ||
    codigo === "57014" ||
    codigo === "40001" ||
    codigo === "40P01" ||
    codigo === "55P03" ||
    codigo === "55006"
  );
}

/**
 * Sube los clientes creados sin conexión con la misma RPC del formulario y
 * guarda `tempId -> UUID del servidor` para reescribir las ventas que los usan.
 * Un fallo de red detiene sin perder nada; un rechazo de negocio queda en la
 * lista y se devuelve el error para que la venta siga esperando.
 */
export async function sincronizarContactosPendientesOffline(ambito: string): Promise<ResultadoSincronizacionContactos> {
  if (!hayAlmacenLocal()) return { ok: true, sincronizados: 0 };

  let iniciales: ContactoPendienteOffline[];
  try {
    iniciales = await leerPendientes(ambito);
  } catch {
    return { ok: false, transitorio: true, error: SIN_LEER_PENDIENTES };
  }
  if (iniciales.length === 0) return { ok: true, sincronizados: 0 };

  const clave = clavePendientes(ambito);
  return conBloqueoOffline(clave, async () => {
    const pendientes = await leerPendientes(ambito);
    if (pendientes.length === 0) return { ok: true, sincronizados: 0 };

    const mapa = await leerMapa(ambito);
    const resueltos = new Set<string>();
    let fallo: ResultadoSincronizacionContactos | null = null;

    let cliente: ReturnType<typeof createClient>;
    try {
      cliente = createClient();
    } catch {
      return { ok: false, transitorio: true, error: SIN_CONEXION };
    }

    for (const pendiente of pendientes) {
      let respuesta: { data: string | null; error: { message: string; code?: string } | null };
      try {
        respuesta = await cliente.rpc("crear_contacto", { p: pendiente.payload });
      } catch {
        fallo = { ok: false, transitorio: true, error: SIN_CONEXION };
        break;
      }

      if (respuesta.error) {
        fallo = {
          ok: false,
          transitorio: errorTransitorioContacto(respuesta.error.code),
          error: respuesta.error.message,
        };
        break;
      }

      if (typeof respuesta.data !== "string" || !UUID.test(respuesta.data)) {
        fallo = { ok: false, transitorio: false, error: SIN_CLIENTE_CREADO };
        break;
      }

      mapa[pendiente.tempId] = respuesta.data;
      resueltos.add(pendiente.tempId);
    }

    if (resueltos.size > 0) {
      const restantes = pendientes.filter((pendiente) => !resueltos.has(pendiente.tempId));
      await guardarOffline("config", claveMapa(ambito), mapa);
      await guardarOffline("config", clave, restantes);
    }

    return fallo ?? { ok: true, sincronizados: resueltos.size };
  });
}

/** Traduce el `tempId` de un cliente nuevo por su UUID del servidor cuando ya existe. */
export async function resolverContactoIdOffline(
  ambito: string,
  contactoId: string,
): Promise<ResolucionContactoOffline> {
  if (!hayAlmacenLocal()) return { estado: "original", id: contactoId };

  try {
    const mapa = await leerMapa(ambito);
    const servidorId = mapa[contactoId];
    if (servidorId) return { estado: "resuelto", id: servidorId };

    const pendientes = await leerPendientes(ambito);
    if (pendientes.some((pendiente) => pendiente.tempId === contactoId)) return { estado: "pendiente" };
  } catch {
    // Si el almacén local no responde, la venta sigue con el id original.
  }

  return { estado: "original", id: contactoId };
}
