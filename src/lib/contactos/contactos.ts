import { z } from "zod";

import { errorIdentificacion, normalizarIdentificacion, type TipoIdentificacion } from "./contacto-rapido";

export type ContactoTipo = "cliente" | "proveedor" | "ambos";
export type PestanaContactos = "todos" | "clientes" | "proveedores";

export const SIN_LISTA_PRECIO = "__sin_lista__";

export interface Contacto {
  id: string;
  nombre: string;
  rnc_cedula: string | null;
  telefono: string | null;
  correo: string | null;
  direccion: string | null;
  tipo: ContactoTipo;
  lista_precio_id: string | null;
  tipo_identificacion?: TipoIdentificacion | null;
  municipio_provincia?: string | null;
  limite_credito?: number | null;
}

export const TIPOS_CONTACTO: { valor: ContactoTipo; etiqueta: string }[] = [
  { valor: "cliente", etiqueta: "Cliente" },
  { valor: "proveedor", etiqueta: "Proveedor" },
  { valor: "ambos", etiqueta: "Cliente y proveedor" },
];

export function etiquetaTipoContacto(tipo: ContactoTipo) {
  return TIPOS_CONTACTO.find((item) => item.valor === tipo)?.etiqueta ?? tipo;
}

export function normalizarNombre(valor: string) {
  return valor.trim().replace(/\s+/g, " ");
}

export function normalizarRncCedula(valor: string) {
  return valor.replace(/\D/g, "");
}

export function esRncCedulaValida(valor: string) {
  return /^(\d{9}|\d{11})$/.test(valor);
}

export function normalizarTelefono(valor: string) {
  const prefijo = valor.trim().startsWith("+") ? "+" : "";
  return `${prefijo}${valor.replace(/\D/g, "")}`;
}

export function textoOpcional(valor: string | null | undefined): string | null {
  const texto = (valor ?? "").trim();
  return texto === "" ? null : texto;
}

export function normalizarBusqueda(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const campoTipo = z.enum(["cliente", "proveedor", "ambos"]);
const campoOpcional = z.string().nullish().transform(textoOpcional);
const campoTipoIdentificacion = z.enum(["rnc", "cedula", "pasaporte"]);
const campoLimiteCredito = z
  .string()
  .nullish()
  .transform((valor) => {
    const monto = textoOpcional(valor);
    return monto === null ? null : monto.replace(/\s/g, "").replace(/,/g, "");
  })
  .refine(
    (valor) => valor === null || /^\d{1,12}(\.\d{1,2})?$/.test(valor),
    "El límite de crédito debe ser un monto válido (hasta 2 decimales)",
  );

export const esquemaContacto = z
  .object({
    nombre: z
      .string()
      .transform(normalizarNombre)
      .refine((valor) => valor.length > 0, "El nombre es obligatorio")
      .refine((valor) => valor.length <= 200, "El nombre no puede pasar de 200 caracteres"),
    tipo: campoTipo.default("cliente"),
    tipo_identificacion: campoTipoIdentificacion.nullish(),
    rnc_cedula: campoOpcional,
    telefono: campoOpcional.transform((valor) => (valor === null ? null : normalizarTelefono(valor))),
    correo: campoOpcional.refine(
      (valor) => valor === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor),
      "El correo no es válido",
    ),
    direccion: campoOpcional,
    municipio_provincia: z.string().nullish(),
    lista_precio_id: z
      .string()
      .nullish()
      .transform((valor) => textoOpcional(valor))
      .refine((valor) => valor === null || z.uuid().safeParse(valor).success, "La lista de precios no es válida"),
    limite_credito: campoLimiteCredito,
  })
  .superRefine((datos, ctx) => {
    const error = errorIdentificacion(datos.tipo_identificacion, datos.rnc_cedula ?? "");
    if (error) ctx.addIssue({ code: "custom", path: ["rnc_cedula"], message: error });
  })
  .transform((datos) => ({
    ...datos,
    rnc_cedula:
      datos.rnc_cedula === null ? null : normalizarIdentificacion(datos.tipo_identificacion, datos.rnc_cedula),
    ...(datos.municipio_provincia === undefined
      ? {}
      : { municipio_provincia: textoOpcional(datos.municipio_provincia) }),
  }));

export type DatosContacto = z.infer<typeof esquemaContacto>;

function coincidePestana(tipo: ContactoTipo, pestana: PestanaContactos) {
  if (pestana === "todos") return true;
  if (pestana === "clientes") return tipo === "cliente" || tipo === "ambos";
  return tipo === "proveedor" || tipo === "ambos";
}

function coincideBusqueda(contacto: Contacto, termino: string) {
  if (termino === "") return true;
  const valores = [contacto.nombre, contacto.rnc_cedula ?? "", contacto.telefono ?? "", contacto.correo ?? ""];
  return valores.some((valor) => normalizarBusqueda(valor).includes(termino));
}

export function filtrarContactos(contactos: Contacto[], pestana: PestanaContactos, busqueda: string): Contacto[] {
  const termino = normalizarBusqueda(busqueda);
  return contactos.filter((contacto) => coincidePestana(contacto.tipo, pestana) && coincideBusqueda(contacto, termino));
}

export function leerPestanaContactos(valor: string): PestanaContactos {
  return valor === "clientes" || valor === "proveedores" ? valor : "todos";
}
