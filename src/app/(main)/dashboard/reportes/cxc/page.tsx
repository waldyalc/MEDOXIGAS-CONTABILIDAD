import { Card, CardContent } from "@/components/ui/card";
import { formatoDia } from "@/lib/formato";
import {
  filtrarCartera,
  filtrarPorPeriodoEmision,
  filtrosDesdeUrl,
  totalCartera,
} from "@/lib/reportes/administrativos/d/antiguedad";
import { obtenerCarteraCxc } from "@/lib/reportes/administrativos/d/consultas";
import { tablaCuentasPorCobrar } from "@/lib/reportes/administrativos/d/exportar";
import {
  leerFechaParametro,
  leerPagina,
  leerParametro,
  leerVista,
  paginar,
  resolverPeriodoCartera,
} from "@/lib/reportes/administrativos/d/parametros";
import { hoyRd, type ParametrosFecha } from "@/lib/reportes/fechas";

import { AlertaError } from "../_components/alerta-error";
import { BotonDescargar } from "../_components/boton-descargar";
import { EncabezadoReporte } from "../_components/encabezado-reporte";
import { FiltrosCartera } from "./_components/filtros-cartera";
import { Paginador } from "./_components/paginador";
import { PestanasAntiguedad } from "./_components/pestanas-antiguedad";
import { TablaCuentasPorCobrar } from "./_components/tabla-cartera";
import { TarjetaPeriodoCartera } from "./_components/tarjeta-periodo-cartera";
import { TarjetaTotal } from "./_components/tarjeta-total";

const BASE = "/dashboard/reportes/cxc";
const POR_PAGINA = 20;

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosFecha> }) {
  const params = await searchParams;
  const { desde, hasta } = resolverPeriodoCartera(params, hoyRd());
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

  const filasPeriodo = filtrarPorPeriodoEmision(filas, desde, hasta);
  const filtradas = filtrarCartera(filasPeriodo, filtros);
  const totalPorCobrar = totalCartera(filtradas);
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const pagina = paginar(filtradas, leerPagina(params, totalPaginas), POR_PAGINA);

  const tabla = tablaCuentasPorCobrar(filtradas, `Del ${formatoDia(desde)} al ${formatoDia(hasta)}`);
  const nombreArchivo = `cuentas-por-cobrar-${desde}-${hasta}${vista === "todas" ? "" : `-${vista}`}`;

  return (
    <div className="flex flex-col gap-5">
      <EncabezadoReporte
        titulo="Cuentas por cobrar"
        descripcion="Conoce lo que te deben tus clientes y lleva un control del vencimiento de sus facturas."
        desde={desde}
        hasta={hasta}
        migas={[
          { etiqueta: "Inicio", href: "/dashboard" },
          { etiqueta: "Reportes", href: "/dashboard/reportes" },
          { etiqueta: "Cuentas por cobrar" },
        ]}
        acciones={<BotonDescargar tabla={tabla} nombreArchivo={nombreArchivo} />}
      />

      <TarjetaPeriodoCartera
        desde={desde}
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

      <FiltrosCartera
        tipo="cobrar"
        base={BASE}
        params={params}
        desde={desde}
        hasta={hasta}
        vista={vista}
        ncf={filtros.ncf}
        contacto={filtros.contacto}
        creacionDesde={filtros.creacionDesde}
        creacionHasta={filtros.creacionHasta}
        vencimientoDesde={filtros.vencimientoDesde}
        vencimientoHasta={filtros.vencimientoHasta}
      />

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
