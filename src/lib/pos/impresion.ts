import type { DocumentoVista } from "@/lib/cotizaciones/tipos";
import { tituloTipoComprobante } from "@/lib/facturacion/comprobantes";
import { aNumero, formatoCantidad, formatoMoneda } from "@/lib/facturacion/formato";
import type { ContactoResumen, Empresa, FacturaDetalle, FacturaLinea } from "@/lib/facturacion/tipos";
import { formatoDia, formatoFechaHora } from "@/lib/formato";
import type { Impuesto } from "@/lib/impuestos/tipos";

import { calcularLineaPOS, compararMontos, precioConImpuesto, sumarMontos } from "./calculo";
import { normalizarPlantilla } from "./mapeo";
import type {
  AnchoTicket,
  CierreTurnoPOS,
  ContactoPOS,
  CotizacionPOSResultado,
  Decimal,
  DevolucionPOSResultado,
  EstiloTicket,
  FuenteTicket,
  ImpuestoPOS,
  InterlineadoTicket,
  LineaDevolucionPOS,
  LineaVenta,
  MetodoPOS,
  MotivoMovimientoPOS,
  MovimientoTurnoPOSResultado,
  PlantillaTicket,
  TamanoLetraTicket,
  TipoReembolsoPOS,
  VentaPOSResultado,
} from "./tipos";

/**
 * Armado puro de los dos formatos de impresión del POS:
 *
 * - `TicketPOSPayload`: ticket térmico de 80/57 mm. No consulta ni imprime;
 *   `TicketPos` (2D) solo pinta este objeto con `plantilla_ticket`.
 * - `DocumentoCartaFacturaPOS` / `DocumentoCartaCotizacionPOS`: props listas
 *   para `DocumentoPapel`, con montos numéricos de presentación.
 *
 * Nada de este módulo escribe en la base ni usa la clave de servicio.
 */

export type DocumentoTicketPOS = "factura" | "cotizacion" | "devolucion" | "cierre" | "movimiento";

export interface DisenoTicketPOS {
  ancho_mm: AnchoTicket;
  estilo: EstiloTicket;
  fuente: FuenteTicket;
  tamano_letra: TamanoLetraTicket;
  interlineado: InterlineadoTicket;
  columnas: "dos" | "apilada";
  mostrar_logo: boolean;
  logo_url: string | null;
  pie: string | null;
}

export interface EncabezadoTicketPOS {
  empresa: string[];
  titulo: string;
  lineas: string[];
  anulada: boolean;
}

/** Bloque del cliente: nombre en fuerte y documento/dirección debajo. */
export interface ClienteTicketPOS {
  nombre: string | null;
  lineas: string[];
}

export interface LineaTicketPOS {
  descripcion: string;
  referencia: string | null;
  detalle: string;
  precio_unitario: string | null;
  descuento: string | null;
  total: string;
}

export interface FilaTicketPOS {
  etiqueta: string;
  valor: string;
  negativo?: boolean;
}

export interface BloqueTicketPOS {
  titulo: string;
  filas: FilaTicketPOS[];
}

export interface TicketPOSPayload {
  tipo: DocumentoTicketPOS;
  diseno: DisenoTicketPOS;
  encabezado: EncabezadoTicketPOS;
  cliente: ClienteTicketPOS;
  lineas: LineaTicketPOS[];
  bloques: BloqueTicketPOS[];
  totales: FilaTicketPOS[];
  pagos: FilaTicketPOS[];
  /** Conteos del pie del documento (líneas y unidades vendidas). */
  resumen: FilaTicketPOS[];
  nota: string | null;
  pie: string | null;
  anulada: boolean;
}

export interface OpcionesCartaPOS {
  mostrarLogo: boolean;
  notas?: string | null;
  terminos?: string | null;
  pie?: string | null;
}

export interface OpcionesTicketPOS {
  /** Hora de recepción cuando la RPC de la venta aún no devuelve `creado_en`. */
  recibido_en?: string | null;
}

export interface DocumentoCartaFacturaPOS {
  tipo: "factura";
  empresa: Empresa | null;
  factura: FacturaDetalle;
  lineas: FacturaLinea[];
  contacto: ContactoResumen;
  ncfVence: string | null;
  impuestos: Impuesto[];
  mostrarLogo: boolean;
}

export interface DocumentoCartaCotizacionPOS {
  tipo: "cotizacion";
  vista: DocumentoVista;
  mostrarLogo: boolean;
}

// ---------------------------------------------------------------------------
// Presentación
// ---------------------------------------------------------------------------

const ETIQUETAS_METODO: Record<MetodoPOS, string> = {
  efectivo: "Efectivo",
  tarjeta_debito: "Tarjeta débito",
  tarjeta_credito: "Tarjeta crédito",
  transferencia: "Transferencia",
};

const ETIQUETAS_MOTIVO_MOVIMIENTO: Record<MotivoMovimientoPOS, string> = {
  fondo_caja: "Fondo de caja",
  cobro_factura: "Cobro de factura",
  retiro_caja: "Retiro de caja",
  gasto_menor: "Gasto menor",
  deposito_banco: "Depósito al banco",
  otro: "Otro",
};

const ETIQUETAS_REEMBOLSO: Record<TipoReembolsoPOS, string> = {
  credito_factura: "Crédito a factura",
  efectivo: "Efectivo",
  combinado: "Combinado",
};

function horaDe(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return null;

  // «4:40 pm», como el ticket de Alegra: hora sin cero y am/pm en minúscula.
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Santo_Domingo",
  })
    .format(fecha)
    .toLowerCase();
}

function fechaConHora(fecha: string, creadoEn: string | null | undefined): string {
  const hora = horaDe(creadoEn);
  const dia = formatoDia(fecha);
  return hora ? `${dia} ${hora}` : dia;
}

function fila(etiqueta: string, valor: string, negativo = false): FilaTicketPOS {
  return negativo ? { etiqueta, valor, negativo: true } : { etiqueta, valor };
}

/** «RD$50.00» sin espacio, como el ticket de Alegra. */
function moneda(valor: string): string {
  return formatoMoneda(valor).replace(/^RD\$ /, "RD$");
}

/** «50.00» sin símbolo: los totales de cada ítem del ticket van sin moneda. */
function numero(valor: string): string {
  return moneda(valor).replace(/^RD\$/, "");
}

function montoNegativo(valor: string): string {
  return `-${moneda(valor)}`;
}

function disenoDe(
  plantilla: PlantillaTicket | null | undefined,
  empresa: { logo_url: string | null } | null,
): DisenoTicketPOS {
  const normalizada = normalizarPlantilla(plantilla);
  const logo = normalizada.mostrar_logo ? (empresa?.logo_url ?? null) : null;

  return {
    ancho_mm: normalizada.ancho_mm,
    estilo: normalizada.estilo,
    fuente: normalizada.fuente,
    tamano_letra: normalizada.tamano_letra,
    interlineado: normalizada.interlineado,
    columnas: normalizada.ancho_mm === 57 ? "apilada" : "dos",
    mostrar_logo: normalizada.mostrar_logo,
    logo_url: logo,
    pie: normalizada.pie_ticket,
  };
}

function lineasEmpresa(
  empresa: {
    nombre: string | null;
    rnc: string | null;
    direccion: string | null;
    telefono: string | null;
    correo: string | null;
  } | null,
): string[] {
  if (!empresa) return [];

  const lineas: string[] = [];
  if (empresa.nombre?.trim()) lineas.push(empresa.nombre.trim());
  if (empresa.rnc?.trim()) lineas.push(`RNC: ${empresa.rnc.trim()}`);
  if (empresa.direccion?.trim()) lineas.push(empresa.direccion.trim());
  if (empresa.telefono?.trim()) lineas.push(`Tel.: ${empresa.telefono.trim()}`);
  if (empresa.correo?.trim()) lineas.push(empresa.correo.trim());

  return lineas;
}

function itbisPorTasa(lineas: readonly { itbis_tasa: Decimal; itbis: Decimal }[]): {
  etiqueta: string;
  total: string;
}[] {
  const grupos = new Map<string, string[]>();

  for (const linea of lineas) {
    if (compararMontos(linea.itbis, "0") <= 0) continue;
    const lista = grupos.get(linea.itbis_tasa) ?? [];
    lista.push(linea.itbis);
    grupos.set(linea.itbis_tasa, lista);
  }

  return [...grupos.entries()]
    .sort(([a], [b]) => Number(b) - Number(a))
    .map(([tasa, montos]) => ({
      etiqueta: `ITBIS ${formatoCantidad(tasa)}%`,
      total: sumarMontos(montos),
    }));
}

/**
 * Base exenta y gravada del documento, como en el ticket de Alegra: suma los
 * subtotales (ya netos de descuento) según la tasa de ITBIS de cada línea.
 */
function exentoGravado(lineas: readonly { subtotal: Decimal; itbis_tasa: Decimal }[]): {
  exento: Decimal;
  gravado: Decimal;
} {
  const exento: Decimal[] = [];
  const gravado: Decimal[] = [];

  for (const linea of lineas) {
    if (compararMontos(linea.itbis_tasa, "0") > 0) gravado.push(linea.subtotal);
    else exento.push(linea.subtotal);
  }

  return { exento: sumarMontos(exento), gravado: sumarMontos(gravado) };
}

/** Conteos del pie del ticket: cantidad de líneas y unidades totales. */
function resumenLineas(lineas: readonly { cantidad: Decimal }[]): FilaTicketPOS[] {
  return [
    fila("Total de líneas", String(lineas.length)),
    fila("Total de productos", formatoCantidad(sumarMontos(lineas.map((linea) => linea.cantidad)))),
  ];
}

/** Bloque del cliente: nombre y documento (cédula o RNC según el contacto). */
function clienteDe(contacto: ContactoPOS | null | undefined): ClienteTicketPOS {
  if (!contacto) return { nombre: null, lineas: [] };

  const lineas: string[] = [];
  const documento = contacto.rnc_cedula?.trim();
  if (documento) {
    const etiqueta = contacto.tipo_identificacion === "cedula" ? "Cédula" : "RNC";
    lineas.push(`${etiqueta}: ${documento}`);
  }
  if (contacto.direccion?.trim()) lineas.push(contacto.direccion.trim());

  return { nombre: contacto.nombre?.trim() || null, lineas };
}

function lineaDeVenta(linea: LineaVenta, plantilla: PlantillaTicket): LineaTicketPOS {
  const precioMostrado = plantilla.precios_con_impuestos
    ? precioConImpuesto(linea.precio, linea.itbis_tasa)
    : linea.precio;
  const unidad = plantilla.mostrar_unidad && linea.unidad_nombre ? ` ${linea.unidad_nombre}` : "";
  const descuento = calcularLineaPOS({
    cantidad: linea.cantidad,
    precio: linea.precio,
    descuento_pct: linea.descuento_pct,
    itbis_tasa: linea.itbis_tasa,
  }).descuento;

  const partes: string[] = [];
  if (plantilla.mostrar_precio_unitario) {
    // «1 x 50.00»: cantidad por precio sin símbolo de moneda, como Alegra.
    partes.push(`${formatoCantidad(linea.cantidad)}${unidad} x ${numero(precioMostrado)}`);
  } else {
    partes.push(`${formatoCantidad(linea.cantidad)}${unidad}`);
  }
  if (compararMontos(linea.descuento_pct, "0") > 0) partes.push(`Desc. ${formatoCantidad(linea.descuento_pct)}%`);

  return {
    descripcion: plantilla.mostrar_descripcion || !linea.producto_nombre ? linea.descripcion : linea.producto_nombre,
    referencia: plantilla.mostrar_referencia ? linea.referencia : null,
    detalle: partes.join(" · "),
    precio_unitario: plantilla.mostrar_precio_unitario ? numero(precioMostrado) : null,
    descuento: compararMontos(descuento, "0") > 0 ? montoNegativo(descuento) : null,
    total: numero(linea.total),
  };
}

function lineaDeDevolucion(linea: LineaDevolucionPOS, plantilla: PlantillaTicket): LineaTicketPOS {
  const precioMostrado = plantilla.precios_con_impuestos
    ? precioConImpuesto(linea.precio, linea.itbis_tasa)
    : linea.precio;
  const unidad = plantilla.mostrar_unidad && linea.unidad_nombre ? ` ${linea.unidad_nombre}` : "";
  const partes: string[] = [];
  if (plantilla.mostrar_precio_unitario) {
    partes.push(`${formatoCantidad(linea.cantidad)}${unidad} x ${numero(precioMostrado)}`);
  } else {
    partes.push(`${formatoCantidad(linea.cantidad)}${unidad}`);
  }

  return {
    descripcion: linea.descripcion,
    referencia: null,
    detalle: partes.join(" · "),
    precio_unitario: plantilla.mostrar_precio_unitario ? numero(precioMostrado) : null,
    descuento: compararMontos(linea.descuento_pct, "0") > 0 ? `Desc. ${formatoCantidad(linea.descuento_pct)}%` : null,
    total: numero(linea.total),
  };
}

function totalesFactura(resultado: VentaPOSResultado): FilaTicketPOS[] {
  const { factura, totales, lineas } = resultado;
  const bruto = sumarMontos([totales.subtotal, totales.descuento]);
  const { exento, gravado } = exentoGravado(lineas);
  const filas: FilaTicketPOS[] = [fila("Subtotal", moneda(bruto))];

  if (compararMontos(totales.descuento, "0") > 0) {
    filas.push(fila("Descuento", montoNegativo(totales.descuento)));
  }

  filas.push(fila("Subtotal Exento", moneda(exento)));
  filas.push(fila("Subtotal Gravado", moneda(gravado)));

  for (const itbis of itbisPorTasa(lineas)) {
    filas.push(fila(itbis.etiqueta, moneda(itbis.total)));
  }

  if (compararMontos(totales.otros_impuestos, "0") > 0) {
    filas.push(fila("Otros impuestos", moneda(totales.otros_impuestos)));
  }
  if (compararMontos(totales.propina, "0") > 0) {
    filas.push(fila("Propina", moneda(totales.propina)));
  }

  filas.push(fila("Total", moneda(totales.total)));

  if (compararMontos(factura.saldo, "0") > 0 || compararMontos(factura.credito, "0") > 0) {
    filas.push(fila("Pagado", moneda(factura.pagado)));
    if (compararMontos(factura.credito, "0") > 0) filas.push(fila("Crédito", moneda(factura.credito)));
    filas.push(fila("Saldo", moneda(factura.saldo)));
  }

  return filas;
}

/** «Método de pago: Efectivo» del encabezado; «Combinado» si hubo varios. */
function metodoPago(resultado: VentaPOSResultado): string | null {
  const metodos = [...new Set(resultado.pagos.map((pago) => pago.metodo_pos))];
  if (metodos.length === 0) return null;
  if (metodos.length > 1) return "Combinado";
  const unico = metodos[0];
  return unico ? ETIQUETAS_METODO[unico] : null;
}

/**
 * Cobro debajo del Total, como Alegra: «Total recibido: RD$X» y «Cambio: RD$X».
 * Ya no es un bloque «Pagos» aparte: el método va en el encabezado.
 */
function cobroFactura(resultado: VentaPOSResultado): FilaTicketPOS[] {
  const filas: FilaTicketPOS[] = [];
  const montoRecibido = resultado.factura.monto_recibido ?? "0";
  const recibido =
    compararMontos(montoRecibido, "0") > 0 ? montoRecibido : sumarMontos(resultado.pagos.map((pago) => pago.monto));

  if (compararMontos(recibido, "0") > 0) {
    filas.push(fila("Total recibido", moneda(recibido)));
  }
  if (resultado.factura.cambio && compararMontos(resultado.factura.cambio, "0") > 0) {
    filas.push(fila("Cambio", moneda(resultado.factura.cambio)));
  }

  return filas;
}

function encabezadoConEmpresa(
  empresa: VentaPOSResultado["empresa"] | CotizacionPOSResultado["empresa"],
  titulo: string,
  lineas: string[],
  anulada = false,
): EncabezadoTicketPOS {
  return { empresa: lineasEmpresa(empresa), titulo, lineas, anulada };
}

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

export function armarTicketFactura(
  resultado: VentaPOSResultado,
  plantilla?: PlantillaTicket | null,
  opciones: OpcionesTicketPOS = {},
): TicketPOSPayload {
  const normalizada = normalizarPlantilla(plantilla ?? resultado.terminal.plantilla_ticket);
  const factura = resultado.factura;
  const esCredito = compararMontos(factura.saldo, "0") > 0 || compararMontos(factura.credito, "0") > 0;
  const metodo = metodoPago(resultado);
  const lineas = [
    ...(factura.ncf ? [`NCF ${factura.ncf}`] : []),
    `Fecha: ${fechaConHora(factura.fecha, factura.creado_en ?? opciones.recibido_en)}`,
    `Tipo de pago: ${esCredito ? "Crédito" : "Contado"}`,
    ...(metodo ? [`Método de pago: ${metodo}`] : []),
    ...(normalizada.mostrar_vendedor && resultado.vendedor ? [`Vendedor: ${resultado.vendedor.nombre}`] : []),
    `Vencimiento: ${formatoDia(factura.vencimiento)}`,
    ...(resultado.ncf_vence ? [`Vence NCF: ${formatoDia(resultado.ncf_vence)}`] : []),
  ];

  return {
    tipo: "factura",
    diseno: disenoDe(normalizada, resultado.empresa),
    encabezado: encabezadoConEmpresa(
      resultado.empresa,
      tituloTipoComprobante(factura.tipo_comprobante),
      lineas,
      factura.estado === "anulada",
    ),
    cliente: clienteDe(resultado.contacto),
    lineas: resultado.lineas.map((linea) => lineaDeVenta(linea, normalizada)),
    bloques: [],
    totales: totalesFactura(resultado),
    pagos: cobroFactura(resultado),
    resumen: resumenLineas(resultado.lineas),
    nota: null,
    pie: normalizada.pie_ticket,
    anulada: factura.estado === "anulada",
  };
}

export function armarTicketCotizacion(
  resultado: CotizacionPOSResultado,
  plantilla?: PlantillaTicket | null,
): TicketPOSPayload {
  const normalizada = normalizarPlantilla(plantilla ?? resultado.plantilla_ticket);
  const cotizacion = resultado.cotizacion;
  const lineas = [
    `Fecha: ${formatoDia(cotizacion.fecha)}`,
    `Vence: ${formatoDia(cotizacion.vencimiento)}`,
    ...(normalizada.mostrar_vendedor && resultado.vendedor ? [`Vendedor: ${resultado.vendedor.nombre}`] : []),
  ];

  const bruto = sumarMontos([resultado.totales.subtotal, resultado.totales.descuento]);
  const { exento, gravado } = exentoGravado(resultado.lineas);
  const totales: FilaTicketPOS[] = [fila("Subtotal", moneda(bruto))];
  if (compararMontos(resultado.totales.descuento, "0") > 0) {
    totales.push(fila("Descuento", montoNegativo(resultado.totales.descuento)));
  }
  totales.push(fila("Subtotal Exento", moneda(exento)));
  totales.push(fila("Subtotal Gravado", moneda(gravado)));
  for (const itbis of itbisPorTasa(resultado.lineas)) {
    totales.push(fila(itbis.etiqueta, moneda(itbis.total)));
  }
  if (compararMontos(resultado.totales.otros_impuestos, "0") > 0) {
    totales.push(fila("Otros impuestos", moneda(resultado.totales.otros_impuestos)));
  }
  if (compararMontos(resultado.totales.propina, "0") > 0) {
    totales.push(fila("Propina", moneda(resultado.totales.propina)));
  }
  totales.push(fila("Total", moneda(resultado.totales.total)));

  return {
    tipo: "cotizacion",
    diseno: disenoDe(normalizada, resultado.empresa),
    encabezado: encabezadoConEmpresa(resultado.empresa, `Cotización No ${cotizacion.numero}`, lineas),
    cliente: clienteDe(resultado.contacto),
    lineas: resultado.lineas.map((linea) => lineaDeVenta(linea, normalizada)),
    bloques: [],
    totales,
    pagos: [],
    resumen: resumenLineas(resultado.lineas),
    nota: "No es una factura.",
    pie: normalizada.pie_ticket,
    anulada: false,
  };
}

export function armarTicketDevolucion(
  resultado: DevolucionPOSResultado,
  plantilla?: PlantillaTicket | null,
): TicketPOSPayload {
  const normalizada = normalizarPlantilla(plantilla ?? resultado.terminal.plantilla_ticket);
  const nota = resultado.nota;
  const origen = resultado.factura.ncf ?? `No ${resultado.factura.numero}`;
  const lineas = [`NCF ${nota.ncf}`, `Fecha: ${formatoDia(nota.fecha)}`, `Factura origen: ${origen}`];

  const reembolso: FilaTicketPOS[] = [
    fila("Efectivo", moneda(resultado.reembolso.efectivo)),
    fila("Crédito a factura", moneda(resultado.reembolso.credito)),
    ...(resultado.reembolso.cuenta_nombre ? [fila("Cuenta de efectivo", resultado.reembolso.cuenta_nombre)] : []),
  ];

  const { exento, gravado } = exentoGravado(resultado.lineas);

  return {
    tipo: "devolucion",
    diseno: disenoDe(normalizada, resultado.empresa),
    encabezado: encabezadoConEmpresa(resultado.empresa, "Nota de Crédito", lineas),
    cliente: clienteDe(resultado.contacto),
    lineas: resultado.lineas.map((linea) => lineaDeDevolucion(linea, normalizada)),
    bloques: [{ titulo: ETIQUETAS_REEMBOLSO[nota.tipo_reembolso], filas: reembolso }],
    totales: [
      fila("Subtotal", moneda(resultado.totales.subtotal)),
      fila("Subtotal Exento", moneda(exento)),
      fila("Subtotal Gravado", moneda(gravado)),
      fila("ITBIS", moneda(resultado.totales.itbis)),
      fila("Total", moneda(resultado.totales.total)),
    ],
    pagos: [],
    resumen: resumenLineas(resultado.lineas),
    nota: null,
    pie: normalizada.pie_ticket,
    anulada: nota.estado === "anulada",
  };
}

export function armarTicketCierre(resultado: CierreTurnoPOS, plantilla?: PlantillaTicket | null): TicketPOSPayload {
  const normalizada = normalizarPlantilla(plantilla ?? resultado.terminal.plantilla_ticket);
  const { turno, resumen } = resultado;
  const lineas = [
    `Terminal: ${resultado.terminal.nombre}`,
    `Abierto: ${formatoFechaHora(turno.abierto_en)}`,
    ...(turno.cerrado_en ? [`Cerrado: ${formatoFechaHora(turno.cerrado_en)}`] : []),
    ...(turno.abierto_por_nombre ? [`Abierto por: ${turno.abierto_por_nombre}`] : []),
    ...(turno.cerrado_por_nombre ? [`Cerrado por: ${turno.cerrado_por_nombre}`] : []),
  ];

  const bloques: BloqueTicketPOS[] = [
    {
      titulo: "Base inicial",
      filas: [fila("Base", moneda(resumen.efectivo.base_inicial))],
    },
    {
      titulo: "Ventas por método",
      filas: [
        fila("Efectivo", moneda(resumen.ventas.por_metodo.efectivo)),
        fila("Tarjeta", moneda(resumen.ventas.por_metodo.tarjeta)),
        fila("Transferencia", moneda(resumen.ventas.por_metodo.transferencia)),
        fila("Crédito", moneda(resumen.ventas.por_metodo.credito)),
      ],
    },
    {
      titulo: "Ingresos",
      filas: [
        fila("Fondo de caja", moneda(resumen.ingresos.por_motivo.fondo_caja)),
        fila("Cobro de factura", moneda(resumen.ingresos.por_motivo.cobro_factura)),
        fila("Otro ingreso", moneda(resumen.ingresos.por_motivo.otro)),
        fila("Total ingresos", moneda(resumen.ingresos.total)),
      ],
    },
    {
      titulo: "Retiros",
      filas: [
        fila("Retiro de caja", moneda(resumen.retiros.por_motivo.retiro_caja)),
        fila("Gasto menor", moneda(resumen.retiros.por_motivo.gasto_menor)),
        fila("Depósito al banco", moneda(resumen.retiros.por_motivo.deposito_banco)),
        fila("Otro retiro", moneda(resumen.retiros.por_motivo.otro)),
        fila("Total retiros", moneda(resumen.retiros.total)),
      ],
    },
    {
      titulo: "Devoluciones",
      filas: [
        fila("Cantidad", String(resumen.devoluciones.cantidad)),
        fila("Efectivo", montoNegativo(resumen.devoluciones.efectivo), true),
        fila("Crédito", moneda(resumen.devoluciones.credito)),
        fila("Total", moneda(resumen.devoluciones.total)),
      ],
    },
    {
      titulo: "Movimientos",
      filas: resumen.movimientos.map((movimiento) => {
        const signo = movimiento.tipo === "retiro" ? "Retiro" : "Ingreso";
        const vigencia = movimiento.vigente ? "" : " · No vigente";
        const hora = horaDe(movimiento.creado_en);
        return fila(
          `#${movimiento.numero}${hora ? ` ${hora}` : ""} · ${signo} · ${ETIQUETAS_MOTIVO_MOVIMIENTO[movimiento.motivo]}${vigencia}`,
          movimiento.tipo === "retiro" ? montoNegativo(movimiento.monto) : moneda(movimiento.monto),
          movimiento.tipo === "retiro",
        );
      }),
    },
    {
      titulo: "Total de movimientos",
      filas: [
        fila("Ingresos", String(resumen.ingresos.cantidad)),
        fila("Retiros", String(resumen.retiros.cantidad)),
        fila("Total", String(resumen.ingresos.cantidad + resumen.retiros.cantidad)),
      ],
    },
  ];

  if (turno.observaciones) {
    bloques.push({ titulo: "Observaciones", filas: [fila("", turno.observaciones)] });
  }

  const diferencia = resumen.efectivo.diferencia;
  let diferenciaTexto = "Cuadra";
  if (diferencia && compararMontos(diferencia, "0") > 0) diferenciaTexto = `Sobrante ${moneda(diferencia)}`;
  if (diferencia && compararMontos(diferencia, "0") < 0) {
    const absoluto = diferencia.startsWith("-") ? diferencia.slice(1) : diferencia;
    diferenciaTexto = `Faltante ${moneda(absoluto)}`;
  }

  return {
    tipo: "cierre",
    diseno: disenoDe(normalizada, resultado.empresa),
    encabezado: encabezadoConEmpresa(resultado.empresa, `Cierre No ${turno.numero}`, lineas),
    cliente: { nombre: null, lineas: [] },
    lineas: [],
    bloques,
    totales: [
      fila("Efectivo esperado en caja", moneda(resumen.efectivo.efectivo_esperado)),
      fila("Efectivo real en caja", moneda(resumen.efectivo.efectivo_real ?? "0")),
      fila("Diferencia", diferenciaTexto),
    ],
    pagos: [],
    resumen: [],
    nota: null,
    pie: normalizada.pie_ticket,
    anulada: false,
  };
}

export function armarTicketMovimiento(
  resultado: MovimientoTurnoPOSResultado,
  plantilla?: PlantillaTicket | null,
  opciones: { incluirEfectivoEsperado?: boolean } = {},
): TicketPOSPayload {
  const normalizada = normalizarPlantilla(plantilla ?? resultado.plantilla_ticket);
  const movimiento = resultado.movimiento;
  const titulo =
    movimiento.tipo === "ingreso"
      ? `Recibo de ingreso No ${movimiento.numero}`
      : `Recibo de retiro No ${movimiento.numero}`;

  const detalle: FilaTicketPOS[] = [
    fila("Motivo", ETIQUETAS_MOTIVO_MOVIMIENTO[movimiento.motivo]),
    fila("Monto", moneda(movimiento.monto)),
    ...(movimiento.cuenta_nombre ? [fila("Cuenta", movimiento.cuenta_nombre)] : []),
    ...(movimiento.factura_numero
      ? [
          fila(
            "Factura",
            `No ${movimiento.factura_numero}${movimiento.factura_ncf ? ` · ${movimiento.factura_ncf}` : ""}`,
          ),
        ]
      : []),
    ...(movimiento.notas ? [fila("Notas", movimiento.notas)] : []),
  ];

  const totales: FilaTicketPOS[] = [fila("Total del recibo", moneda(movimiento.monto))];
  if (opciones.incluirEfectivoEsperado !== false) {
    totales.push(fila("Efectivo esperado después", moneda(resultado.resumen.efectivo.efectivo_esperado)));
  }

  return {
    tipo: "movimiento",
    diseno: disenoDe(normalizada, resultado.empresa),
    encabezado: encabezadoConEmpresa(resultado.empresa, titulo, [
      `Fecha: ${formatoFechaHora(movimiento.creado_en)}`,
      `Turno No ${resultado.turno.numero}`,
      ...(resultado.movimiento.cajero ? [`Cajero: ${resultado.movimiento.cajero}`] : []),
    ]),
    cliente: { nombre: null, lineas: [] },
    lineas: [],
    bloques: [{ titulo: "Detalle", filas: detalle }],
    totales,
    pagos: [],
    resumen: [],
    nota: null,
    pie: normalizada.pie_ticket,
    anulada: false,
  };
}

// ---------------------------------------------------------------------------
// PDF Carta (props de DocumentoPapel)
// ---------------------------------------------------------------------------

function tipoImpuesto(valor: string): Impuesto["tipo"] {
  if (valor === "itbis" || valor === "otro" || valor === "propina" || valor === "exento" || valor === "ninguno") {
    return valor;
  }
  return "otro";
}

function impuestosCarta(impuestos: readonly ImpuestoPOS[]): Impuesto[] {
  return impuestos.map((impuesto) => ({
    id: impuesto.id,
    codigo: impuesto.codigo,
    nombre: impuesto.nombre,
    tipo: tipoImpuesto(impuesto.tipo),
    tarifa: aNumero(impuesto.tarifa),
    cuenta_id: impuesto.cuenta_id,
    activo: impuesto.activo,
    orden: impuesto.orden,
  }));
}

function empresaCarta(empresa: VentaPOSResultado["empresa"]): Empresa | null {
  if (!empresa) return null;
  return {
    id: empresa.id,
    nombre: empresa.nombre ?? "",
    rnc: empresa.rnc,
    direccion: empresa.direccion,
    telefono: empresa.telefono,
    correo: empresa.correo,
    logo_url: empresa.logo_url,
  };
}

function contactoCarta(contacto: VentaPOSResultado["contacto"]): ContactoResumen {
  return {
    id: contacto.id,
    nombre: contacto.nombre,
    rnc_cedula: contacto.rnc_cedula,
    direccion: contacto.direccion,
    telefono: contacto.telefono,
    lista_precio_id: contacto.lista_precio_id,
  };
}

function lineasCarta(lineas: readonly LineaVenta[]): FacturaLinea[] {
  return lineas.map((linea) => ({
    id: linea.id,
    producto_id: linea.producto_id,
    descripcion: linea.descripcion,
    cantidad: aNumero(linea.cantidad),
    precio: aNumero(linea.precio),
    descuento_pct: aNumero(linea.descuento_pct),
    itbis_tasa: aNumero(linea.itbis_tasa),
    impuesto_id: linea.impuesto_id,
    subtotal: aNumero(linea.subtotal),
    itbis: aNumero(linea.itbis),
    total: aNumero(linea.total),
  }));
}

/** Props completas para `<DocumentoPapel tipo="factura" {...carta} />`. */
export function armarCartaFactura(resultado: VentaPOSResultado, opciones: OpcionesCartaPOS): DocumentoCartaFacturaPOS {
  const factura = resultado.factura;
  const detalle: FacturaDetalle = {
    id: factura.id,
    numero: factura.numero,
    ncf: factura.ncf,
    tipo_comprobante: factura.tipo_comprobante,
    contacto_id: resultado.contacto.id,
    fecha: factura.fecha,
    vencimiento: factura.vencimiento,
    total: aNumero(factura.total),
    pagado: aNumero(factura.pagado),
    credito: aNumero(factura.credito),
    retenido: aNumero(factura.retenido),
    estado: factura.estado,
    subtotal: aNumero(factura.subtotal),
    descuento: aNumero(factura.descuento),
    itbis: aNumero(factura.itbis),
    otros_impuestos: aNumero(factura.otros_impuestos),
    propina: aNumero(factura.propina),
    notas: factura.notas ?? opciones.notas ?? null,
    terminos: factura.terminos ?? opciones.terminos ?? null,
    pie: factura.pie ?? opciones.pie ?? null,
    asiento_id: factura.asiento_id,
    vendedor_id: factura.vendedor_id,
    centro_costo_id: factura.centro_costo_id,
  };

  return {
    tipo: "factura",
    empresa: empresaCarta(resultado.empresa),
    factura: detalle,
    lineas: lineasCarta(resultado.lineas),
    contacto: contactoCarta(resultado.contacto),
    ncfVence: resultado.ncf_vence,
    impuestos: impuestosCarta(resultado.impuestos),
    mostrarLogo: opciones.mostrarLogo,
  };
}

/** Props completas para `<DocumentoPapel tipo="cotizacion" {...carta} />`. */
export function armarCartaCotizacion(
  resultado: CotizacionPOSResultado,
  opciones: OpcionesCartaPOS,
): DocumentoCartaCotizacionPOS {
  const cotizacion = resultado.cotizacion;
  const estado: DocumentoVista["documento"]["estado"] =
    cotizacion.estado === "anulada" || cotizacion.estado === "convertida" ? cotizacion.estado : "abierta";

  const documento: DocumentoVista["documento"] = {
    id: cotizacion.id,
    numero: cotizacion.numero,
    contacto_id: cotizacion.contacto_id,
    fecha: cotizacion.fecha,
    vencimiento: cotizacion.vencimiento,
    total: aNumero(cotizacion.total),
    estado,
    factura_id: null,
    subtotal: aNumero(cotizacion.subtotal),
    descuento: aNumero(cotizacion.descuento),
    itbis: aNumero(cotizacion.itbis),
    otros_impuestos: aNumero(cotizacion.otros_impuestos),
    propina: aNumero(cotizacion.propina),
    notas: cotizacion.notas ?? opciones.notas ?? null,
    terminos: cotizacion.terminos ?? opciones.terminos ?? null,
    vendedor_id: cotizacion.vendedor_id,
    centro_costo_id: cotizacion.centro_costo_id,
  };

  return {
    tipo: "cotizacion",
    vista: {
      documento,
      lineas: lineasCarta(resultado.lineas),
      impuestos: impuestosCarta(resultado.impuestos),
      contacto: contactoCarta(resultado.contacto),
      empresa: empresaCarta(resultado.empresa),
      facturaRelacionada: null,
      cotizacionOrigen: null,
      remisionRelacionada: null,
    },
    mostrarLogo: opciones.mostrarLogo,
  };
}
