import {
  calcularLinea,
  calcularTotales,
  centavosAValor,
  type LineaCalculada,
  parsearCantidad,
  parsearCentavos,
  type TotalesFactura,
} from "@/lib/facturacion/calculo";

export interface LineaFormulario {
  clave: string;
  productoId: string;
  cantidad: string;
  precio: string;
  descuentoPct: string;
  impuestoId: string;
  itbisTasa: string;
}

export interface ProductoParaLinea {
  id: string;
  nombre: string;
}

export interface PagoFormulario {
  cuentaId: string;
  metodo: string;
}

export interface DatosDocumento {
  clienteId: string;
  fecha: string;
  vencimiento: string;
  notas: string;
  lineas: LineaFormulario[];
  productos: readonly ProductoParaLinea[];
  almacenId?: string;
  tipoComprobante?: string;
  terminos?: string;
  pie?: string;
  vendedorId?: string;
  centroCostoId?: string;
  pago?: PagoFormulario;
  cotizacionId?: string;
}

export interface LineaCalculadaFormulario {
  clave: string;
  calculo: LineaCalculada;
}

export interface ValidacionDocumento {
  clienteId: string;
  fecha: string;
  vencimiento: string;
  conVencimiento?: boolean;
  lineas: LineaFormulario[];
  totalCentavos: number;
  requiereCuentaPago?: boolean;
  cuentaPago?: string;
}

export type CampoLineaDocumento = "producto" | "cantidad" | "precio" | "descuento";

export type CampoDocumento =
  | "cliente"
  | "fecha"
  | "vencimiento"
  | "lineas"
  | "cuentaPago"
  | "total"
  | { linea: string; campo: CampoLineaDocumento };

export interface ErrorDocumento {
  campo: CampoDocumento;
  mensaje: string;
}

export interface DocumentoCalculado {
  calculadas: LineaCalculadaFormulario[];
  totales: TotalesFactura;
}

export function lineaVacia(clave: string, impuestoId = "", itbisTasa = "0"): LineaFormulario {
  return { clave, productoId: "", cantidad: "1", precio: "0.00", descuentoPct: "0", impuestoId, itbisTasa };
}

export function numero(texto: string): number {
  const valor = Number(texto);
  return Number.isFinite(valor) ? valor : 0;
}

export function calcularDocumento(lineas: LineaFormulario[]): DocumentoCalculado {
  const calculadas = lineas.map((linea) => ({
    clave: linea.clave,
    calculo: calcularLinea({
      cantidad: parsearCantidad(linea.cantidad),
      precioCentavos: parsearCentavos(linea.precio) ?? 0,
      descuentoPct: numero(linea.descuentoPct),
      itbisTasa: numero(linea.itbisTasa),
    }),
  }));

  return { calculadas, totales: calcularTotales(calculadas.map((linea) => linea.calculo)) };
}

/** Clave estable para buscar el error de un campo, incluidas las líneas. */
export function claveErrorDocumento(campo: CampoDocumento): string {
  return typeof campo === "string" ? campo : `${campo.campo}:${campo.linea}`;
}

/** id del control (o del mensaje, si el campo no es un control) al que se lleva el foco. */
export function idCampoDocumento(campo: CampoDocumento): string {
  if (typeof campo !== "string") return `${campo.campo}-${campo.linea}`;
  if (campo === "cuentaPago") return "cuenta-pago";
  if (campo === "total") return "total-error";
  if (campo === "lineas") return "lineas-error";
  return campo;
}

function esFechaISO(valor: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor);
}

function erroresFechas(datos: ValidacionDocumento): ErrorDocumento[] {
  const errores: ErrorDocumento[] = [];

  if (!esFechaISO(datos.fecha)) {
    errores.push({ campo: "fecha", mensaje: "La fecha es requerida." });
  }

  if (datos.conVencimiento === false) return errores;

  if (!esFechaISO(datos.vencimiento)) {
    errores.push({ campo: "vencimiento", mensaje: "La fecha de vencimiento es requerida." });
    return errores;
  }

  if (esFechaISO(datos.fecha) && datos.vencimiento < datos.fecha) {
    errores.push({
      campo: "vencimiento",
      mensaje: "La fecha de vencimiento no puede ser anterior a la fecha de creación.",
    });
  }

  return errores;
}

function erroresLinea(linea: LineaFormulario): ErrorDocumento[] {
  const errores: ErrorDocumento[] = [];

  if (!linea.productoId) {
    errores.push({
      campo: { linea: linea.clave, campo: "producto" },
      mensaje: "El producto es requerido.",
    });
  }
  if (parsearCantidad(linea.cantidad) <= 0) {
    errores.push({
      campo: { linea: linea.clave, campo: "cantidad" },
      mensaje: "La cantidad debe ser mayor que cero.",
    });
  }
  if (parsearCentavos(linea.precio) === null) {
    errores.push({
      campo: { linea: linea.clave, campo: "precio" },
      mensaje: "El precio no es válido.",
    });
  }
  const descuento = numero(linea.descuentoPct);
  if (descuento < 0 || descuento > 100) {
    errores.push({
      campo: { linea: linea.clave, campo: "descuento" },
      mensaje: "El descuento debe estar entre 0 y 100.",
    });
  }

  return errores;
}

/** Errores de los campos obligatorios, en el orden en que se deben corregir. */
export function erroresValidacionDocumento(datos: ValidacionDocumento): ErrorDocumento[] {
  const errores: ErrorDocumento[] = [];

  if (!datos.clienteId) {
    errores.push({ campo: "cliente", mensaje: "El cliente es requerido." });
  }

  errores.push(...erroresFechas(datos));

  if (datos.lineas.length === 0) {
    errores.push({ campo: "lineas", mensaje: "Agrega al menos una línea." });
  }

  for (const linea of datos.lineas) {
    errores.push(...erroresLinea(linea));
  }

  if (datos.totalCentavos <= 0) {
    errores.push({ campo: "total", mensaje: "El total del documento debe ser mayor que cero." });
  }

  if (datos.requiereCuentaPago && !datos.cuentaPago) {
    errores.push({ campo: "cuentaPago", mensaje: "La cuenta de caja o banco es requerida." });
  }

  return errores;
}

export function construirEntrada(datos: DatosDocumento) {
  const { totales } = calcularDocumento(datos.lineas);
  const notas = datos.notas.trim();
  const terminos = datos.terminos?.trim() ?? "";
  const pie = datos.pie?.trim() ?? "";

  return {
    ...(datos.tipoComprobante ? { tipo_comprobante: datos.tipoComprobante } : {}),
    ...(datos.cotizacionId ? { cotizacion_id: datos.cotizacionId } : {}),
    contacto_id: datos.clienteId,
    fecha: datos.fecha,
    vencimiento: datos.vencimiento,
    ...(datos.almacenId ? { almacen_id: datos.almacenId } : {}),
    ...(notas ? { notas } : {}),
    ...(terminos ? { terminos } : {}),
    ...(pie ? { pie } : {}),
    ...(datos.vendedorId ? { vendedor_id: datos.vendedorId } : {}),
    ...(datos.centroCostoId ? { centro_costo_id: datos.centroCostoId } : {}),
    lineas: datos.lineas.map((linea) => {
      const producto = datos.productos.find((item) => item.id === linea.productoId);
      return {
        producto_id: linea.productoId,
        descripcion: producto?.nombre ?? "",
        cantidad: parsearCantidad(linea.cantidad),
        precio: centavosAValor(parsearCentavos(linea.precio) ?? 0),
        descuento_pct: numero(linea.descuentoPct),
        itbis_tasa: numero(linea.itbisTasa),
        impuesto_id: linea.impuestoId || null,
      };
    }),
    ...(datos.pago
      ? {
          pago: {
            cuenta_id: datos.pago.cuentaId,
            metodo: datos.pago.metodo,
            monto: centavosAValor(totales.totalCentavos),
          },
        }
      : {}),
  };
}
