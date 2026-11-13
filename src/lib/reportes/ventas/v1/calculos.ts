import { centavos } from "../../dinero";
import type { FilaReporte, TablaReporte } from "../../exportar/tipos";
import type {
  EstadoVenta,
  FacturaVenta,
  FiltrosVentas,
  PaginaVentas,
  Periodicidad,
  PuntoSerieVentas,
  TotalesVentas,
  VentaCalculada,
} from "./tipos";

export const ALMACEN_PRINCIPAL = "Principal";

const TAMANO_PAGINA = 10;

const ETIQUETAS_ESTADO: Record<string, string> = {
  abierta: "Por cobrar",
  pagada: "Cobrada",
  anulada: "Anulada",
};

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function etiquetaEstado(estado: string): string {
  return ETIQUETAS_ESTADO[estado] ?? "Por cobrar";
}

export function calcularVentas(
  facturas: readonly FacturaVenta[],
  clientes: Readonly<Record<string, string>>,
): VentaCalculada[] {
  return facturas.map((factura) => {
    const estado = factura.estado as EstadoVenta;

    return {
      id: factura.id,
      numero: factura.numero,
      ncf: factura.ncf ?? `#${factura.numero}`,
      tipoComprobante: factura.tipo_comprobante,
      contactoId: factura.contacto_id,
      clienteNombre: clientes[factura.contacto_id] ?? "—",
      estado,
      estadoEtiqueta: etiquetaEstado(estado),
      fecha: factura.fecha,
      subtotal: centavos(factura.subtotal) + centavos(factura.descuento),
      descuento: centavos(factura.descuento),
      antesImpuestos: centavos(factura.subtotal),
      impuestos: centavos(factura.itbis),
      despuesImpuestos: centavos(factura.total),
    };
  });
}

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function filtrarVentas(ventas: readonly VentaCalculada[], filtros: FiltrosVentas): VentaCalculada[] {
  const busqueda = normalizar(filtros.busqueda.trim());

  return ventas.filter((venta) => {
    if (filtros.tipoComprobante && venta.tipoComprobante !== filtros.tipoComprobante) return false;
    if (!busqueda) return true;

    return normalizar(venta.ncf).includes(busqueda) || normalizar(venta.clienteNombre).includes(busqueda);
  });
}

export function calcularTotales(ventas: readonly VentaCalculada[]): TotalesVentas {
  const totales: TotalesVentas = {
    ventasBrutas: 0,
    notasCredito: 0,
    antesImpuestos: 0,
    impuestos: 0,
    despuesImpuestos: 0,
  };

  for (const venta of ventas) {
    if (venta.estado === "anulada") continue;

    totales.ventasBrutas += venta.subtotal;
    totales.antesImpuestos += venta.antesImpuestos;
    totales.impuestos += venta.impuestos;
    totales.despuesImpuestos += venta.despuesImpuestos;
  }

  return totales;
}

function etiquetaSerie(clave: string, periodicidad: Periodicidad): string {
  if (periodicidad === "diario") return `${clave.slice(8, 10)}/${clave.slice(5, 7)}`;

  const mes = Number(clave.slice(5, 7));
  return `${MESES[mes - 1] ?? ""} ${clave.slice(0, 4)}`;
}

export function agruparSerie(ventas: readonly VentaCalculada[], periodicidad: Periodicidad): PuntoSerieVentas[] {
  const totales = new Map<string, number>();

  for (const venta of ventas) {
    if (venta.estado === "anulada") continue;

    const clave = periodicidad === "diario" ? venta.fecha.slice(0, 10) : venta.fecha.slice(0, 7);
    totales.set(clave, (totales.get(clave) ?? 0) + venta.despuesImpuestos);
  }

  return [...totales.entries()]
    .map(([clave, total]) => ({ clave, etiqueta: etiquetaSerie(clave, periodicidad), total }))
    .sort((a, b) => a.clave.localeCompare(b.clave));
}

export function paginar(
  ventas: readonly VentaCalculada[],
  pagina: number,
  tamano: number = TAMANO_PAGINA,
): PaginaVentas {
  const porPagina = Number.isFinite(tamano) && tamano >= 1 ? Math.trunc(tamano) : TAMANO_PAGINA;
  const totalFilas = ventas.length;
  const totalPaginas = Math.max(1, Math.ceil(totalFilas / porPagina));
  const solicitada = Number.isFinite(pagina) ? Math.trunc(pagina) : 1;
  const paginaActual = Math.min(Math.max(1, solicitada), totalPaginas);
  const inicio = (paginaActual - 1) * porPagina;

  return {
    filas: ventas.slice(inicio, inicio + porPagina),
    pagina: paginaActual,
    totalPaginas,
    totalFilas,
  };
}

function columnasVentas(): TablaReporte["columnas"] {
  return [
    { clave: "documento", titulo: "Documento", tipo: "texto" },
    { clave: "cliente", titulo: "Cliente", tipo: "texto" },
    { clave: "estado", titulo: "Estado", tipo: "texto" },
    { clave: "fecha", titulo: "Creación", tipo: "fecha" },
    { clave: "subtotal", titulo: "Subtotal", tipo: "dinero" },
    { clave: "descuento", titulo: "Descuento", tipo: "dinero" },
    { clave: "antesImpuestos", titulo: "Antes de impuestos", tipo: "dinero" },
    { clave: "impuestos", titulo: "Impuestos", tipo: "dinero" },
    { clave: "despuesImpuestos", titulo: "Después de impuestos", tipo: "dinero" },
  ];
}

function filaVenta(venta: VentaCalculada): FilaReporte {
  return {
    celdas: {
      documento: venta.ncf,
      cliente: venta.clienteNombre,
      estado: venta.estadoEtiqueta,
      fecha: venta.fecha,
      subtotal: venta.subtotal,
      descuento: venta.descuento,
      antesImpuestos: venta.antesImpuestos,
      impuestos: venta.impuestos,
      despuesImpuestos: venta.despuesImpuestos,
    },
  };
}

function celdasTotales(totales: TotalesVentas): FilaReporte["celdas"] {
  return {
    documento: "Total",
    cliente: null,
    estado: null,
    fecha: null,
    subtotal: totales.ventasBrutas,
    descuento: totales.ventasBrutas - totales.antesImpuestos,
    antesImpuestos: totales.antesImpuestos,
    impuestos: totales.impuestos,
    despuesImpuestos: totales.despuesImpuestos,
  };
}

export function crearTablaVentasGenerales(ventas: readonly VentaCalculada[], subtitulo: string): TablaReporte {
  return {
    titulo: "Ventas generales",
    subtitulo,
    columnas: columnasVentas(),
    filas: [...ventas.map(filaVenta), { celdas: celdasTotales(calcularTotales(ventas)), estilo: "total" }],
  };
}

function columnasVentasAlmacen(): TablaReporte["columnas"] {
  const columnas = columnasVentas();
  const indiceFecha = columnas.findIndex((columna) => columna.clave === "fecha");

  columnas.splice(indiceFecha + 1, 0, { clave: "almacen", titulo: "Almacén", tipo: "texto" });
  columnas.splice(indiceFecha + 2, 0, { clave: "centroCostos", titulo: "Centro de costos", tipo: "texto" });

  return columnas;
}

function filaVentaAlmacen(venta: VentaCalculada): FilaReporte {
  return {
    celdas: {
      documento: venta.ncf,
      cliente: venta.clienteNombre,
      estado: venta.estadoEtiqueta,
      fecha: venta.fecha,
      almacen: ALMACEN_PRINCIPAL,
      centroCostos: null,
      subtotal: venta.subtotal,
      descuento: venta.descuento,
      antesImpuestos: venta.antesImpuestos,
      impuestos: venta.impuestos,
      despuesImpuestos: venta.despuesImpuestos,
    },
  };
}

function celdasTotalesAlmacen(totales: TotalesVentas): FilaReporte["celdas"] {
  return {
    documento: "Total",
    cliente: null,
    estado: null,
    fecha: null,
    almacen: null,
    centroCostos: null,
    subtotal: totales.ventasBrutas,
    descuento: totales.ventasBrutas - totales.antesImpuestos,
    antesImpuestos: totales.antesImpuestos,
    impuestos: totales.impuestos,
    despuesImpuestos: totales.despuesImpuestos,
  };
}

export function crearTablaVentasAlmacen(ventas: readonly VentaCalculada[], subtitulo: string): TablaReporte {
  return {
    titulo: "Ventas por almacén",
    subtitulo,
    columnas: columnasVentasAlmacen(),
    filas: [
      ...ventas.map(filaVentaAlmacen),
      { celdas: celdasTotalesAlmacen(calcularTotales(ventas)), estilo: "total" },
    ],
  };
}
