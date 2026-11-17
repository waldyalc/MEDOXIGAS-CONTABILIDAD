import { BarraLista, ContenedorLista, TarjetaLista } from "@/components/listas/tabla-lista";
import { MigasDePan } from "@/components/migas-de-pan";
import { formatoDia } from "@/lib/formato";
import { filtrarCompras, totalesCompras } from "@/lib/reportes/administrativos/d/compras";
import { obtenerCompras } from "@/lib/reportes/administrativos/d/consultas";
import { tablaCompras } from "@/lib/reportes/administrativos/d/exportar";
import { leerPagina, leerParametro, paginar } from "@/lib/reportes/administrativos/d/parametros";
import { type ParametrosFecha, parsearRango } from "@/lib/reportes/fechas";

import { AlertaError } from "../_components/alerta-error";
import { BotonDescargar } from "../_components/boton-descargar";
import { BotonImprimir } from "../_components/boton-imprimir";
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
      <MigasDePan
        items={[
          { etiqueta: "Reportes", href: "/dashboard/reportes" },
          { etiqueta: "Administrativos", href: "/dashboard/reportes?categoria=Administrativos" },
          { etiqueta: "Compras" },
        ]}
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Compras</h1>
          <p className="text-muted-foreground text-sm">
            Consulta el detalle de las facturas de compra que tienes registradas en tu contabilidad.
          </p>
          <p className="text-muted-foreground text-sm">
            Del {formatoDia(desde)} al {formatoDia(hasta)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BotonDescargar tabla={tabla} nombreArchivo={nombreArchivo} />
          <BotonImprimir />
        </div>
      </div>

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
