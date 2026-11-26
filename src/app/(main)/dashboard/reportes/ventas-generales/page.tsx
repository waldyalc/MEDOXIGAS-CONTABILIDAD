import { cache, Suspense } from "react";

import { EsqueletoFiltros, EsqueletoGrafico, EsqueletoTabla, EsqueletoTarjetas } from "@/components/carga/esqueletos";
import { formatoDia } from "@/lib/formato";
import { leerTamanoConDefecto } from "@/lib/listas/parametros";
import { type ParametrosFecha, parsearRango } from "@/lib/reportes/fechas";
import {
  agruparSerie,
  calcularTotales,
  calcularVentas,
  crearTablaVentasGenerales,
  filtrarVentas,
  paginar,
} from "@/lib/reportes/ventas/v1/calculos";
import { obtenerVentas } from "@/lib/reportes/ventas/v1/consultas";
import { parsearFiltrosVentas, urlVentas } from "@/lib/reportes/ventas/v1/filtros";
import type { FiltrosVentasUrl } from "@/lib/reportes/ventas/v1/tipos";

import { AlertaError } from "../_components/alerta-error";
import { BotonDescargar } from "../_components/boton-descargar";
import { EncabezadoReporte } from "../_components/encabezado-reporte";
import { FiltrosVentas } from "./_components/filtros-ventas";
import { GraficoVentas } from "./_components/grafico-ventas";
import { TablaVentas } from "./_components/tabla-ventas";
import { TarjetasVentas } from "./_components/tarjetas-ventas";

const RUTA = "/dashboard/reportes/ventas-generales";

interface Carga {
  desde: string;
  hasta: string;
  filtros: FiltrosVentasUrl;
  params: ParametrosFecha;
  tamano: number;
}

// cache() comparte una sola consulta y un solo cálculo entre las tarjetas, el
// gráfico, la tabla y la descarga: cada Suspense los pide en paralelo.
const TAMANO_DEFECTO = 20;

const cargarReporte = cache(async (desde: string, hasta: string, filtros: FiltrosVentasUrl, tamano: number) => {
  const { facturas, clientes, numeraciones, error } = await obtenerVentas(desde, hasta);
  const ventas = filtrarVentas(calcularVentas(facturas, clientes), filtros);
  const totales = calcularTotales(ventas);
  const serie = agruparSerie(ventas, filtros.grafico);
  const pagina = paginar(ventas, filtros.pagina, tamano);
  const subtitulo = `Periodo: ${formatoDia(desde)} al ${formatoDia(hasta)}`;
  const tabla = crearTablaVentasGenerales(ventas, subtitulo);

  return { error, numeraciones, totales, serie, pagina, tabla };
});

async function FiltrosYDescarga({ desde, hasta, filtros, tamano }: Carga) {
  const { numeraciones, tabla } = await cargarReporte(desde, hasta, filtros, tamano);

  return (
    <>
      <FiltrosVentas desde={desde} hasta={hasta} filtros={filtros} numeraciones={numeraciones} />
      <BotonDescargar tabla={tabla} nombreArchivo={`ventas-generales-${desde}-${hasta}`} />
    </>
  );
}

async function AvisoError({ desde, hasta, filtros, tamano }: Carga) {
  const { error } = await cargarReporte(desde, hasta, filtros, tamano);
  return error ? <AlertaError mensaje={error} /> : null;
}

async function TarjetasDatos({ desde, hasta, filtros, tamano }: Carga) {
  const { totales } = await cargarReporte(desde, hasta, filtros, tamano);
  return <TarjetasVentas totales={totales} />;
}

async function GraficoDatos({ desde, hasta, filtros, tamano }: Carga) {
  const { serie } = await cargarReporte(desde, hasta, filtros, tamano);

  return (
    <GraficoVentas
      serie={serie}
      grafico={filtros.grafico}
      hrefDiario={urlVentas(RUTA, { desde, hasta, ...filtros, grafico: "diario", pagina: 1 })}
      hrefMensual={urlVentas(RUTA, { desde, hasta, ...filtros, grafico: "mensual", pagina: 1 })}
    />
  );
}

async function TablaDatos({ desde, hasta, filtros, params, tamano }: Carga) {
  const { pagina } = await cargarReporte(desde, hasta, filtros, tamano);

  return <TablaVentas ruta={RUTA} params={params} pagina={pagina} tamano={tamano} />;
}

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosFecha> }) {
  const params = await searchParams;
  const { desde, hasta } = parsearRango(params);
  const filtros = parsearFiltrosVentas(params);
  const tamano = leerTamanoConDefecto(params, TAMANO_DEFECTO);
  const carga = { desde, hasta, filtros, params, tamano };

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoReporte
        titulo="Ventas generales"
        descripcion="Facturas de venta del período con subtotal, descuentos e impuestos."
        desde={desde}
        hasta={hasta}
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <Suspense fallback={<EsqueletoFiltros campos={4} />}>
          <FiltrosYDescarga {...carga} />
        </Suspense>
      </div>

      <Suspense fallback={null}>
        <AvisoError {...carga} />
      </Suspense>

      <Suspense fallback={<EsqueletoTarjetas />}>
        <TarjetasDatos {...carga} />
      </Suspense>

      <Suspense fallback={<EsqueletoGrafico />}>
        <GraficoDatos {...carga} />
      </Suspense>

      <Suspense fallback={<EsqueletoTabla filas={10} columnas={6} />}>
        <TablaDatos {...carga} />
      </Suspense>
    </div>
  );
}
