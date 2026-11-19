import { Card, CardContent } from "@/components/ui/card";
import { formatoDia } from "@/lib/formato";
import { filtrarCartera, filtrosDesdeUrl, totalCartera } from "@/lib/reportes/administrativos/d/antiguedad";
import { obtenerCarteraCxp } from "@/lib/reportes/administrativos/d/consultas";
import { tablaCuentasPorPagar } from "@/lib/reportes/administrativos/d/exportar";
import {
  leerFechaParametro,
  leerPagina,
  leerParametro,
  leerVista,
  paginar,
} from "@/lib/reportes/administrativos/d/parametros";
import { type ParametrosFecha, parsearRango } from "@/lib/reportes/fechas";

import { AlertaError } from "../_components/alerta-error";
import { BotonDescargar } from "../_components/boton-descargar";
import { EncabezadoReporte } from "../_components/encabezado-reporte";
import { FiltrosCartera } from "../cxc/_components/filtros-cartera";
import { Paginador } from "../cxc/_components/paginador";
import { PestanasAntiguedad } from "../cxc/_components/pestanas-antiguedad";
import { TablaCuentasPorPagar } from "../cxc/_components/tabla-cartera";
import { TarjetaTotal } from "../cxc/_components/tarjeta-total";

const BASE = "/dashboard/reportes/cxp";
const POR_PAGINA = 20;

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosFecha> }) {
  const params = await searchParams;
  const { desde, hasta } = parsearRango(params);
  const { filas, error } = await obtenerCarteraCxp(desde, hasta);

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
  const totalPorPagar = totalCartera(filtradas);
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const pagina = paginar(filtradas, leerPagina(params, totalPaginas), POR_PAGINA);

  const tabla = tablaCuentasPorPagar(filtradas, `Del ${formatoDia(desde)} al ${formatoDia(hasta)}`);
  const nombreArchivo = `cuentas-por-pagar-${desde}-${hasta}${vista === "todas" ? "" : `-${vista}`}`;

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoReporte
        titulo="Cuentas por pagar"
        descripcion="Conoce las deudas que tienes registradas y lleva un control de tus pagos pendientes."
        desde={desde}
        hasta={hasta}
        migas={[
          { etiqueta: "Inicio", href: "/dashboard" },
          { etiqueta: "Reportes", href: "/dashboard/reportes" },
          { etiqueta: "Cuentas por pagar" },
        ]}
        acciones={<BotonDescargar tabla={tabla} nombreArchivo={nombreArchivo} />}
      />

      <FiltrosCartera
        tipo="pagar"
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

      <TarjetaTotal etiqueta="Total por pagar" total={totalPorPagar} />

      <p className="text-muted-foreground -mt-3 text-sm print:hidden">
        Las pestañas agrupan las facturas por días vencidos a la fecha de corte.
      </p>

      <Card className="py-0">
        <CardContent className="p-0">
          <TablaCuentasPorPagar filas={pagina.filas} mensajeVacio="¡No tienes facturas pendientes por pagar!" />
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
