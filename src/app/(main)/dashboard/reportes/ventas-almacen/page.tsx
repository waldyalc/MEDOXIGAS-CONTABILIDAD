import { formatoDia } from "@/lib/formato";
import { leerTamanoConDefecto } from "@/lib/listas/parametros";
import { type ParametrosFecha, parsearRango } from "@/lib/reportes/fechas";
import {
  agruparSerie,
  calcularTotales,
  calcularVentas,
  crearTablaVentasAlmacen,
  filtrarVentas,
  paginar,
} from "@/lib/reportes/ventas/v1/calculos";
import { obtenerVentas } from "@/lib/reportes/ventas/v1/consultas";
import { parsearFiltrosVentas, urlVentas } from "@/lib/reportes/ventas/v1/filtros";

import { AlertaError } from "../_components/alerta-error";
import { BotonDescargar } from "../_components/boton-descargar";
import { EncabezadoReporte } from "../_components/encabezado-reporte";
import { FiltrosVentas } from "../ventas-generales/_components/filtros-ventas";
import { GraficoVentas } from "../ventas-generales/_components/grafico-ventas";
import { TablaVentas } from "../ventas-generales/_components/tabla-ventas";
import { TarjetasVentas } from "../ventas-generales/_components/tarjetas-ventas";

const RUTA = "/dashboard/reportes/ventas-almacen";
const TAMANO_DEFECTO = 20;

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosFecha> }) {
  const params = await searchParams;
  const { desde, hasta } = parsearRango(params);
  const filtros = parsearFiltrosVentas(params);
  const { facturas, clientes, numeraciones, error } = await obtenerVentas(desde, hasta);

  const ventas = filtrarVentas(calcularVentas(facturas, clientes), filtros);
  const totales = calcularTotales(ventas);
  const serie = agruparSerie(ventas, filtros.grafico);
  const tamano = leerTamanoConDefecto(params, TAMANO_DEFECTO);
  const pagina = paginar(ventas, filtros.pagina, tamano);
  const subtitulo = `Periodo: ${formatoDia(desde)} al ${formatoDia(hasta)}`;
  const tabla = crearTablaVentasAlmacen(ventas, subtitulo);

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoReporte
        titulo="Ventas por almacén"
        descripcion="Facturas de venta del período agrupadas por almacén, con subtotal, descuentos e impuestos."
        desde={desde}
        hasta={hasta}
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <FiltrosVentas
          desde={desde}
          hasta={hasta}
          filtros={filtros}
          numeraciones={numeraciones}
          mostrarNumeracion={false}
        />
        <BotonDescargar tabla={tabla} nombreArchivo={`ventas-por-almacen-${desde}-${hasta}`} />
      </div>

      {error ? <AlertaError mensaje={error} /> : null}

      <TarjetasVentas totales={totales} />

      <GraficoVentas
        serie={serie}
        grafico={filtros.grafico}
        hrefDiario={urlVentas(RUTA, { desde, hasta, ...filtros, grafico: "diario", pagina: 1 })}
        hrefMensual={urlVentas(RUTA, { desde, hasta, ...filtros, grafico: "mensual", pagina: 1 })}
      />

      <TablaVentas ruta={RUTA} params={params} pagina={pagina} tamano={tamano} porAlmacen />
    </div>
  );
}
