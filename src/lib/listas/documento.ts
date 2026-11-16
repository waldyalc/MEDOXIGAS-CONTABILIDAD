import { limpiarBusqueda, numeroDocumento, patronIlike } from "./busqueda";

export interface CamposDocumento {
  /** Columna del número del documento (por defecto `numero`). */
  numero?: string;
  /** Columnas de texto para un término no numérico; vacío si no hay (pagos). */
  texto?: string | readonly string[];
  /** Columna del contacto (por defecto `contacto_id`). */
  contacto?: string;
  /** Columna del documento relacionado (por defecto `factura_id`). */
  factura?: string;
}

function columnasTexto(campo: string | readonly string[] | undefined): readonly string[] {
  if (campo === undefined) return ["ncf"];
  if (typeof campo === "string") return campo === "" ? [] : [campo];
  return campo;
}

export interface PartesDocumento {
  q: string;
  idsContactos?: readonly string[];
  idsFacturas?: readonly string[];
  campos?: CamposDocumento;
}

/**
 * Condiciones para un `.or()` de PostgREST: el número se busca exacto, un
 * término de texto en las columnas indicadas y los ids ya resueltos (contactos
 * y documento relacionado). Devuelve `null` solo si no hay término. Si hay
 * término pero no hay dónde buscar, devuelve una condición imposible para no
 * mostrar todo.
 */
export function condicionesDocumento({
  q,
  idsContactos = [],
  idsFacturas = [],
  campos = {},
}: PartesDocumento): string | null {
  const termino = limpiarBusqueda(q);
  if (!termino) return null;

  const numero = numeroDocumento(termino);
  const campoNumero = campos.numero ?? "numero";
  const camposTexto = columnasTexto(campos.texto);
  const campoContacto = campos.contacto ?? "contacto_id";
  const campoFactura = campos.factura ?? "factura_id";
  const condiciones: string[] = [];

  if (numero != null) condiciones.push(`${campoNumero}.eq.${numero}`);
  else {
    for (const campo of camposTexto) condiciones.push(`${campo}.ilike.${patronIlike(termino)}`);
  }

  if (idsContactos.length > 0) condiciones.push(`${campoContacto}.in.(${idsContactos.join(",")})`);
  if (idsFacturas.length > 0) condiciones.push(`${campoFactura}.in.(${idsFacturas.join(",")})`);

  // Un término sin columnas donde buscar (pagos) no debe devolver todo.
  return condiciones.length > 0 ? condiciones.join(",") : `${campoNumero}.eq.-1`;
}
