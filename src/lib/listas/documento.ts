import { limpiarBusqueda, numeroDocumento, patronIlike } from "./busqueda";

export interface CamposDocumento {
  /** Columna del número del documento (por defecto `numero`). */
  numero?: string;
  /** Columna de texto para un término no numérico; vacío si no hay (pagos). */
  texto?: string;
  /** Columna del contacto (por defecto `contacto_id`). */
  contacto?: string;
  /** Columna del documento relacionado (por defecto `factura_id`). */
  factura?: string;
}

export interface PartesDocumento {
  q: string;
  idsContactos?: readonly string[];
  idsFacturas?: readonly string[];
  campos?: CamposDocumento;
}

/**
 * Condiciones para un `.or()` de PostgREST: el número se busca exacto, un
 * término de texto en la columna indicada y los ids ya resueltos (contactos y
 * documento relacionado). Devuelve `null` si no hay nada que filtrar.
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
  const campoTexto = campos.texto ?? "ncf";
  const campoContacto = campos.contacto ?? "contacto_id";
  const campoFactura = campos.factura ?? "factura_id";
  const condiciones: string[] = [];

  if (numero != null) condiciones.push(`${campoNumero}.eq.${numero}`);
  else if (campoTexto) condiciones.push(`${campoTexto}.ilike.${patronIlike(termino)}`);

  if (idsContactos.length > 0) condiciones.push(`${campoContacto}.in.(${idsContactos.join(",")})`);
  if (idsFacturas.length > 0) condiciones.push(`${campoFactura}.in.(${idsFacturas.join(",")})`);

  return condiciones.length > 0 ? condiciones.join(",") : null;
}
