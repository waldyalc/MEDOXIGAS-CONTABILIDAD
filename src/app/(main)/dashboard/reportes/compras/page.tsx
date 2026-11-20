import { BarraLista, ContenedorLista, TarjetaLista } from "@/components/listas/tabla-lista";
import { formatoDia } from "@/lib/formato";
import { filtrarCompras, totalesCompras } from "@/lib/reportes/administrativos/d/compras";
import { obtenerCompras } from "@/lib/reportes/administrativos/d/consultas";
import { tablaCompras } from "@/lib/reportes/administrativos/d/exportar";
import { leerPagina, leerParametro, paginar } from "@/lib/reportes/administrativos/d/parametros";
import { type ParametrosFecha, parsearRango } from "@/lib/reportes/fechas";

import { AlertaError } from "../_components/alerta-error";
import { BotonDescargar } from "../_components/boton-descargar";
import { EncabezadoReporte } from "../_components/encabezado-reporte";
import { Paginador } from "../cxc/_components/paginador";
import { FiltroProveedorCompras, FiltrosCompras } from "./_components/filtros-compras";
import { TablaCompras } from "./_components/tabla-compras";
import { TotalesCompras } from "./_components/totales-compras";

const BASE = "/dashboard/reportes/compras";
const POR_PAGINA = 10;

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosFecha> }) {
  const params = await searchParams;
  const { desde, hasta } = parsearRango(params);
  const proveedor = leerParametro(params, "proveedor");
  const { filas, error } = await obtenerCompras(desde, hasta);

  const filtradas = filtrarCompras(filas, { proveedor });
  const totales = totalesCompras(filtradas);
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const pagina = paginar(filtradas, leerPagina(params, totalPaginas), POR_PAGINA);

  const tabla = tablaCompras(filtradas, `Del ${formatoDia(desde)} al ${formatoDia(hasta)}`);
  const nombreArchivo = `compras-${desde}-${hasta}`;

  return (
    <ContenedorLista>
      <EncabezadoReporte
        titulo="Compras"
        descripcion="Consulta el detalle de las facturas de compra que tienes registradas en tu contabilidad."
        desde={desde}
        hasta={hasta}
        acciones={<BotonDescargar tabla={tabla} nombreArchivo={nombreArchivo} />}
      />

      <FiltrosCompras desde={desde} hasta={hasta} />

      {error ? <AlertaError mensaje={error} /> : null}

      <TotalesCompras antesDeImpuestos={totales.antesDeImpuestos} despuesDeImpuestos={totales.despuesDeImpuestos} />

      <TarjetaLista data-lista="reporte-compras">
        <BarraLista className="print:hidden">
          <FiltroProveedorCompras desde={desde} hasta={hasta} proveedor={proveedor} />
        </BarraLista>

        <TablaCompras filas={pagina.filas} />

        {pagina.total > 0 ? (
          <div className="border-border border-t px-4 py-3 print:hidden">
            <Paginador
              base={BASE}
              params={params}
              pagina={pagina.pagina}
              totalPaginas={pagina.totalPaginas}
              inicio={pagina.inicio}
              fin={pagina.fin}
              total={pagina.total}
            />
          </div>
        ) : null}
      </TarjetaLista>
    </ContenedorLista>
  );
}
