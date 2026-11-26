import {
  type IconoTabler,
  TablerBriefcase,
  TablerCash,
  TablerChartBar,
  TablerCoin,
  TablerFileInvoice,
  TablerReportMoney,
  TablerStar,
} from "@/components/icons";
import { COLOR_MARCA_PRIMARIO } from "@/lib/marca";
import type { CategoriaReporte } from "@/lib/reportes/catalogo-reportes";

interface MetaCategoria {
  icono: IconoTabler;
  /** Texto que Alegra revela al pasar el mouse sobre la tarjeta de categoría. */
  descripcion: string;
  /** Color del icono de categoría (hex de Alegra). */
  iconoColor: string;
  /** Fondo pastel del chip de icono en las tarjetas de reporte. */
  iconoFondo: string;
}

export const META_CATEGORIAS: Record<CategoriaReporte, MetaCategoria> = {
  Ventas: {
    icono: TablerCoin,
    descripcion:
      "Monitorea la distribución de tus ventas y obtén información para gestionar tus operaciones comerciales.",
    iconoColor: "#16A34A",
    iconoFondo: "#DCFCE7",
  },
  Administrativos: {
    icono: TablerChartBar,
    descripcion:
      "Haz seguimiento a tus transacciones y obtén información para controlar la salud financiera de tu empresa.",
    iconoColor: COLOR_MARCA_PRIMARIO,
    iconoFondo: "#EAF0FC",
  },
  Financieros: {
    icono: TablerCash,
    descripcion: "Analiza los resultados financieros de tu empresa, incluyendo entradas y salidas de efectivo.",
    iconoColor: "#F54A00",
    iconoFondo: "#FFEDD5",
  },
  Contables: {
    icono: TablerFileInvoice,
    descripcion: "Conoce el desempeño contable y el estado económico de tu empresa en todo momento.",
    iconoColor: "#FBBF24",
    iconoFondo: "#FEF3C7",
  },
  Fiscales: {
    icono: TablerReportMoney,
    descripcion: "Revisa el detalle de tus impuestos y retenciones para cumplir con tus obligaciones tributarias.",
    iconoColor: "#E11D48",
    iconoFondo: "#FFE4E6",
  },
  "Para trabajar": {
    icono: TablerBriefcase,
    descripcion: "Exporta la información clave de tu negocio para realizar análisis adicionales.",
    iconoColor: "#4F46E5",
    iconoFondo: "#E0E7FF",
  },
};

/** Metadatos de la tarjeta «Favoritos» (no es una categoría con reportes). */
export const META_FAVORITOS = {
  icono: TablerStar,
  descripcion: "En este espacio vas a encontrar todos los reportes que has marcado como favoritos.",
  iconoColor: "#64748B",
  iconoFondo: "#F1F5F9",
};

export const DESCRIPCION_REPORTES: Record<string, string> = {
  "Ventas generales": "Consulta tus ventas del período con subtotales, impuestos y totales.",
  "Ventas por producto/servicio": "Conoce las cantidades y montos vendidos de cada producto o servicio.",
  "Ventas por cliente": "Compara las ventas y devoluciones de cada cliente.",
  "Rentabilidad por producto": "Revisa la utilidad y el margen que deja cada producto.",
  "Ventas por vendedor": "Consulta las ventas registradas por cada vendedor.",
  "Estado de cuenta por cliente": "Sigue el saldo, los vencimientos y los cobros de cada cliente.",
  "Ventas por almacén": "Compara las ventas registradas en cada almacén.",

  "Cuentas por cobrar": "Controla el vencimiento y cobro de tus facturas a crédito.",
  "Cuentas por pagar": "Controla tus deudas registradas y pagos pendientes a proveedores.",
  "Ingresos y compras": "Conoce los valores asociados a tus cuentas de ingresos y egresos.",
  "Valor de inventario": "Consulta el valor actual, cantidad y costo promedio de tu inventario.",
  Transacciones: "Consulta los movimientos de dinero registrados en tu contabilidad.",
  Compras: "Consulta las facturas de compra que tienes registradas en tu cuenta.",
  "Reporte anual": "Conoce el rendimiento que ha tenido tu negocio en cada año.",

  "Flujo de caja": "Analiza las entradas y salidas de efectivo y la liquidez de tu negocio.",

  "Estado de resultados": "Conoce el desempeño financiero de tu empresa.",
  "Estado de situación financiera": "Revisa tus activos, pasivos y patrimonio al cierre.",
  "Estado de flujo de efectivo": "Analiza el efectivo generado y usado en tus actividades.",
  "Libro diario": "Consulta todos los asientos contables en orden cronológico.",
  "Auxiliar por tercero": "Detalla los movimientos de cada contacto por cuenta contable.",
  "Balanza de comprobación": "Verifica los débitos y créditos de todas tus cuentas.",
  "Movimientos por cuenta contable": "Revisa los movimientos de una cuenta contable en detalle.",
  "Movimientos por cuenta contable agrupado": "Consulta los movimientos de una cuenta agrupados por contacto.",
  "Balanza de comprobación por tercero": "Compara los débitos y créditos de cada tercero.",

  "Reporte 606": "Formato para reportar tus costos y gastos del ISR a la DGII.",
  "Reporte 607": "Formato para reportar tus ventas de bienes y servicios a la DGII.",
  "Reporte 608": "Formato con los detalles de tus comprobantes fiscales anulados.",
  "Reporte IT1": "Informe de retenciones de ITBIS para la DGII.",
  "Reporte detallado de impuestos": "Detalle de impuestos por tasa en ventas, compras y devoluciones.",
  "Impuestos y retenciones": "Consulta los impuestos y retenciones de ventas y compras.",
  "Reporte IR-17": "Reporte de retenciones de ISR para la DGII.",
  "Cartas de retención": "Genera las cartas de retención de tus comprobantes.",

  "Exportar facturas": "Exporta tus facturas para compartirlas con tu contador.",
  "Informe contador": "Reúne los documentos del período para tu contador.",
};

export function descripcionReporte(nombre: string): string {
  return DESCRIPCION_REPORTES[nombre] ?? "Consulta el detalle de este reporte.";
}
