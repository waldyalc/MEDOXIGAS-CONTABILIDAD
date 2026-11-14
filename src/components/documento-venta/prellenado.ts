import { type LineaFormulario, lineaVacia } from "./calculo";

export interface LineaOrigen {
  producto_id: string | null;
  cantidad: number;
  precio: number;
  descuento_pct: number;
  itbis_tasa: number;
  impuesto_id?: string | null;
}

export interface DocumentoOrigen {
  contacto_id: string;
  fecha: string;
  vencimiento: string;
  notas: string | null;
  terminos?: string | null;
  tipo_comprobante?: string | null;
  vendedor_id?: string | null;
  centro_costo_id?: string | null;
  lineas: readonly LineaOrigen[];
}

export interface ValoresIniciales {
  clienteId: string;
  fecha: string;
  vencimiento: string;
  tipoComprobante?: string;
  lineas: LineaFormulario[];
  notas: string;
  terminos: string;
  vendedorId?: string;
  centroCostoId?: string;
}

export interface OpcionesPrefill {
  conservarFechas?: boolean;
}

export function prellenarDocumento(
  origen: DocumentoOrigen,
  fechaHoy: string,
  opciones: OpcionesPrefill = {},
): ValoresIniciales {
  const lineas = origen.lineas.map((linea, indice) => ({
    clave: `l${indice + 1}`,
    productoId: linea.producto_id ?? "",
    cantidad: String(linea.cantidad),
    precio: linea.precio.toFixed(2),
    descuentoPct: String(linea.descuento_pct),
    impuestoId: linea.impuesto_id ?? "",
    itbisTasa: String(linea.itbis_tasa),
  }));

  return {
    clienteId: origen.contacto_id,
    fecha: opciones.conservarFechas ? origen.fecha : fechaHoy,
    vencimiento: opciones.conservarFechas ? origen.vencimiento : fechaHoy,
    ...(origen.tipo_comprobante ? { tipoComprobante: origen.tipo_comprobante } : {}),
    lineas: lineas.length > 0 ? lineas : [lineaVacia("l1")],
    notas: origen.notas ?? "",
    terminos: origen.terminos ?? "",
    ...(origen.vendedor_id ? { vendedorId: origen.vendedor_id } : {}),
    ...(origen.centro_costo_id ? { centroCostoId: origen.centro_costo_id } : {}),
  };
}

export function conContactoActual<T extends { id: string }>(contactos: readonly T[], actual: T): T[] {
  return contactos.some((contacto) => contacto.id === actual.id) ? [...contactos] : [actual, ...contactos];
}
