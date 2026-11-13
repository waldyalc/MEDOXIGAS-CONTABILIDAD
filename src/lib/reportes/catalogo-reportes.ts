export const CATEGORIAS_REPORTES = [
  "Ventas",
  "Administrativos",
  "Financieros",
  "Contables",
  "Fiscales",
  "Para trabajar",
] as const;

export type CategoriaReporte = (typeof CATEGORIAS_REPORTES)[number];

export interface ReporteCatalogo {
  nombre: string;
  categoria: CategoriaReporte;
  href?: string;
}

const RUTAS_CONTABLES: Record<string, string> = {
  "Estado de resultados": "/dashboard/reportes/estado-resultados",
  "Estado de situación financiera": "/dashboard/reportes/situacion-financiera",
  "Estado de flujo de efectivo": "/dashboard/reportes/flujo-efectivo",
  "Libro diario": "/dashboard/reportes/libro-diario",
  "Auxiliar por tercero": "/dashboard/reportes/auxiliar-tercero",
  "Balanza de comprobación": "/dashboard/reportes/balance-comprobacion",
  "Movimientos por cuenta contable": "/dashboard/reportes/movimientos-cuenta",
  "Movimientos por cuenta contable agrupado": "/dashboard/reportes/movimientos-cuenta-agrupado",
  "Balanza de comprobación por tercero": "/dashboard/reportes/balanza-tercero",
};

function reporteContable(nombre: string): ReporteCatalogo {
  return { nombre, categoria: "Contables", href: RUTAS_CONTABLES[nombre] };
}

export const REPORTES: readonly ReporteCatalogo[] = [
  { nombre: "Ventas generales", categoria: "Ventas", href: "/dashboard/reportes/ventas-generales" },
  {
    nombre: "Ventas por producto/servicio",
    categoria: "Ventas",
    href: "/dashboard/reportes/ventas-producto",
  },
  { nombre: "Ventas por cliente", categoria: "Ventas", href: "/dashboard/reportes/ventas-cliente" },
  {
    nombre: "Rentabilidad por producto",
    categoria: "Ventas",
    href: "/dashboard/reportes/rentabilidad-producto",
  },
  { nombre: "Ventas por vendedor", categoria: "Ventas", href: "/dashboard/reportes/ventas-vendedor" },
  {
    nombre: "Estado de cuenta por cliente",
    categoria: "Ventas",
    href: "/dashboard/reportes/estado-cuenta-cliente",
  },
  { nombre: "Ventas por almacén", categoria: "Ventas", href: "/dashboard/reportes/ventas-almacen" },

  { nombre: "Cuentas por cobrar", categoria: "Administrativos", href: "/dashboard/reportes/cxc" },
  { nombre: "Cuentas por pagar", categoria: "Administrativos", href: "/dashboard/reportes/cxp" },
  { nombre: "Ingresos y compras", categoria: "Administrativos", href: "/dashboard/reportes/ingresos-compras" },
  { nombre: "Valor de inventario", categoria: "Administrativos", href: "/dashboard/reportes/valor-inventario" },
  { nombre: "Transacciones", categoria: "Administrativos", href: "/dashboard/reportes/transacciones" },
  { nombre: "Compras", categoria: "Administrativos", href: "/dashboard/reportes/compras" },
  { nombre: "Reporte anual", categoria: "Administrativos", href: "/dashboard/reportes/reporte-anual" },

  { nombre: "Flujo de caja", categoria: "Financieros" },

  reporteContable("Estado de resultados"),
  reporteContable("Estado de situación financiera"),
  reporteContable("Estado de flujo de efectivo"),
  reporteContable("Libro diario"),
  reporteContable("Auxiliar por tercero"),
  reporteContable("Balanza de comprobación"),
  reporteContable("Movimientos por cuenta contable"),
  reporteContable("Movimientos por cuenta contable agrupado"),
  reporteContable("Balanza de comprobación por tercero"),

  { nombre: "Reporte 606", categoria: "Fiscales" },
  { nombre: "Reporte 607", categoria: "Fiscales" },
  { nombre: "Reporte 608", categoria: "Fiscales" },
  { nombre: "Reporte IT1", categoria: "Fiscales" },
  { nombre: "Reporte detallado de impuestos", categoria: "Fiscales" },
  { nombre: "Impuestos y retenciones", categoria: "Fiscales" },
  { nombre: "Reporte IR-17", categoria: "Fiscales" },
  { nombre: "Cartas de retención", categoria: "Fiscales" },

  { nombre: "Exportar facturas", categoria: "Para trabajar" },
  { nombre: "Informe contador", categoria: "Para trabajar" },
];

export interface GrupoReportes {
  categoria: CategoriaReporte;
  reportes: ReporteCatalogo[];
}

export function reportesPorCategoria(reportes: readonly ReporteCatalogo[] = REPORTES): GrupoReportes[] {
  return CATEGORIAS_REPORTES.map((categoria) => ({
    categoria,
    reportes: reportes.filter((reporte) => reporte.categoria === categoria),
  })).filter((grupo) => grupo.reportes.length > 0);
}

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function filtrarReportes(texto: string, reportes: readonly ReporteCatalogo[] = REPORTES): ReporteCatalogo[] {
  const busqueda = normalizar(texto);
  if (!busqueda) return [...reportes];

  return reportes.filter((reporte) => normalizar(reporte.nombre).includes(busqueda));
}
