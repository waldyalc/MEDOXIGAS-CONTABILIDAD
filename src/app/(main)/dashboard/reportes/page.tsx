import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import {
  CATEGORIAS_REPORTES,
  type CategoriaReporte,
  REPORTES,
  type ReporteCatalogo,
} from "@/lib/reportes/catalogo-reportes";

import { ReportesExplorador } from "./_components/reportes-explorador";

const ENLACES_REPORTES: Record<string, string> = {
  "Reporte 606": "/dashboard/reportes/606",
  "Reporte 607": "/dashboard/reportes/607",
  "Reporte 608": "/dashboard/reportes/608",
  "Reporte IT1": "/dashboard/reportes/it1",
  "Reporte detallado de impuestos": "/dashboard/reportes/impuestos-detallados",
  "Impuestos y retenciones": "/dashboard/reportes/impuestos-retenciones",
  "Reporte IR-17": "/dashboard/reportes/ir-17",
  "Cartas de retención": "/dashboard/reportes/cartas-retencion",
  "Exportar facturas": "/dashboard/reportes/exportar-contador",
  "Informe contador": "/dashboard/reportes/exportar-contador",
  "Flujo de caja": "/dashboard/reportes/flujo-efectivo",
};

function conEnlaces(reportes: readonly ReporteCatalogo[]): ReporteCatalogo[] {
  return reportes.map((reporte) => {
    const href = ENLACES_REPORTES[reporte.nombre];
    return href == null ? reporte : { ...reporte, href };
  });
}

function categoriaValida(valor: string | string[] | undefined): CategoriaReporte | null {
  const texto = Array.isArray(valor) ? valor[0] : valor;
  if (texto == null) return null;
  return (CATEGORIAS_REPORTES as readonly string[]).includes(texto) ? (texto as CategoriaReporte) : null;
}

interface Props {
  searchParams: Promise<{ categoria?: string | string[] }>;
}

export default async function Page({ searchParams }: Props) {
  const parametros = await searchParams;
  const categoria = categoriaValida(parametros.categoria);

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina
        titulo="Reportes"
        subtitulo="Consulta, descarga y comparte la información contable, administrativa y fiscal de tu empresa."
        migas={[{ etiqueta: "Inicio", href: "/dashboard" }, { etiqueta: "Reportes" }]}
      />

      <ReportesExplorador categoria={categoria} reportes={conEnlaces(REPORTES)} />
    </div>
  );
}
