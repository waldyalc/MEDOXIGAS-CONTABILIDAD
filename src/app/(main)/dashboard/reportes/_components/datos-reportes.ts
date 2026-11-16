import { BookOpen, ClipboardList, Landmark, type LucideIcon, ShoppingCart, Wallet, Wrench } from "lucide-react";

import type { CategoriaReporte } from "@/lib/reportes/catalogo-reportes";

interface MetaCategoria {
  icono: LucideIcon;
  descripcion: string;
  iconoClase: string;
}

export const META_CATEGORIAS: Record<CategoriaReporte, MetaCategoria> = {
  Ventas: {
    icono: ShoppingCart,
    descripcion: "Analiza tus ventas y la rentabilidad de cada producto, cliente y vendedor.",
    iconoClase: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  Administrativos: {
    icono: ClipboardList,
    descripcion: "Haz seguimiento a tus transacciones y controla la salud financiera de tu empresa.",
    iconoClase: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  Financieros: {
    icono: Wallet,
    descripcion: "Analiza los resultados financieros de tu empresa y su liquidez.",
    iconoClase: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
  Contables: {
    icono: BookOpen,
    descripcion: "Revisa los estados financieros y los libros contables del período.",
    iconoClase: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  Fiscales: {
    icono: Landmark,
    descripcion: "Prepara los reportes fiscales e informativos que exige la DGII.",
    iconoClase: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
  "Para trabajar": {
    icono: Wrench,
    descripcion: "Herramientas para compartir tu información con tu contador.",
    iconoClase: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
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

  "Estado de resultados": "Conoce tus ingresos, costos y gastos y la utilidad del período.",
  "Estado de situación financiera": "Revisa tus activos, pasivos y patrimonio al cierre.",
  "Estado de flujo de efectivo": "Analiza el efectivo generado y usado en tus actividades.",
  "Libro diario": "Consulta todos los asientos contables en orden cronológico.",
  "Auxiliar por tercero": "Detalla los movimientos de cada contacto por cuenta contable.",
  "Balanza de comprobación": "Verifica los débitos y créditos de todas tus cuentas.",
  "Movimientos por cuenta contable": "Revisa los movimientos de una cuenta contable en detalle.",
  "Movimientos por cuenta contable agrupado": "Consulta los movimientos de una cuenta agrupados por contacto.",
  "Balanza de comprobación por tercero": "Compara los débitos y créditos de cada tercero.",

  "Reporte 606": "Compras e importaciones para el reporte 606 de la DGII.",
  "Reporte 607": "Ventas y operaciones para el reporte 607 de la DGII.",
  "Reporte 608": "Comprobantes anulados para el reporte 608 de la DGII.",
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
