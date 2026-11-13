import { Card, CardContent } from "@/components/ui/card";
import { formatoDia } from "@/lib/formato";
import { filtrarCartera, filtrosDesdeUrl, totalCartera } from "@/lib/reportes/administrativos/d/antiguedad";
import { obtenerCarteraCxc } from "@/lib/reportes/administrativos/d/consultas";
import { tablaCuentasPorCobrar } from "@/lib/reportes/administrativos/d/exportar";
import {
  leerFechaParametro,
  leerPagina,
  leerParametro,
  leerVista,
  paginar,
} from "@/lib/reportes/administrativos/d/parametros";
import { hoyRd, type ParametrosFecha, rangoMesActual } from "@/lib/reportes/fechas";

import { AlertaError } from "../_components/alerta-error";
import { BotonDescargar } from "../_components/boton-descargar";
import { BotonImprimir } from "../_components/boton-imprimir";
import { FiltrosCartera } from "./_components/filtros-cartera";
import { Paginador } from "./_components/paginador";
import { PestanasAntiguedad } from "./_components/pestanas-antiguedad";
import { TablaCuentasPorCobrar } from "./_components/tabla-cartera";
import { TarjetaTotal } from "./_components/tarjeta-total";

const BASE = "/dashboard/reportes/cxc";
const POR_PAGINA = 20;

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosFecha> }) {
  const params = await searchParams;
  const hasta = leerFechaParametro(params, "hasta") ?? rangoMesActual(hoyRd()).hasta;
  const { filas, error } = await obtenerCarteraCxc(hasta);

  const vista = leerVista(params);
  const filtros = filtrosDesdeUrl(
    {
      ncf: leerParametro(params, "ncf"),
      contacto: leerParametro(params, "contacto"),
      creacion_desde: leerFechaParametro(params, "creacion_desde") ?? undefined,
      creacion_hasta: leerFechaParametro(params, "creacion_hasta") ?? undefined,
      vencimiento_desde: leerFechaParametro(params, "vencimiento_desde") ?? undefined,
      vencimiento_hasta: leerFechaParametro(params, "vencimiento_hasta") ?? undefined,
    },
    vista,
  );

  const filtradas = filtrarCartera(filas, filtros);
  const totalPorCobrar = totalCartera(filtradas);
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const pagina = paginar(filtradas, leerPagina(params, totalPaginas), POR_PAGINA);

  const tabla = tablaCuentasPorCobrar(filtradas, `Fecha de corte: ${formatoDia(hasta)}`);
  const nombreArchivo = `cuentas-por-cobrar-${hasta}${vista === "todas" ? "" : `-${vista}`}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Cuentas por cobrar</h1>
          <p className="text-muted-foreground text-sm">
            Conoce lo que te deben tus clientes y lleva un control del vencimiento de sus facturas.
          </p>
          <p className="text-muted-foreground text-sm">Al {formatoDia(hasta)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BotonDescargar tabla={tabla} nombreArchivo={nombreArchivo} />
          <BotonImprimir />
        </div>
      </div>

      <FiltrosCartera
        tipo="cobrar"
        desde={null}
        hasta={hasta}
        vista={vista}
        ncf={filtros.ncf}
        contacto={filtros.contacto}
        creacionDesde={filtros.creacionDesde}
        creacionHasta={filtros.creacionHasta}
        vencimientoDesde={filtros.vencimientoDesde}
        vencimientoHasta={filtros.vencimientoHasta}
      />

      <PestanasAntiguedad base={BASE} params={params} vista={vista} />

      {error ? <AlertaError mensaje={error} /> : null}

      <TarjetaTotal etiqueta="Total por cobrar" total={totalPorCobrar} />

      <p className="text-muted-foreground -mt-3 text-sm print:hidden">
        Las pestañas agrupan las facturas por días vencidos a la fecha de corte.
      </p>

      <Card className="py-0">
        <CardContent className="p-0">
          <TablaCuentasPorCobrar filas={pagina.filas} mensajeVacio="¡No tienes facturas pendientes por cobrar!" />
        </CardContent>
      </Card>

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
  );
}
