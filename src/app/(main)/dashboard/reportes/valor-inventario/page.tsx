import { Card, CardContent } from "@/components/ui/card";
import { formatoDia } from "@/lib/formato";
import { obtenerInventario } from "@/lib/reportes/administrativos/d/consultas";
import { tablaInventario } from "@/lib/reportes/administrativos/d/exportar";
import { filtrarInventario, totalInventario } from "@/lib/reportes/administrativos/d/inventario";
import { leerFechaParametro, leerPagina, leerParametro, paginar } from "@/lib/reportes/administrativos/d/parametros";
import { hoyRd, type ParametrosFecha } from "@/lib/reportes/fechas";

import { AlertaError } from "../_components/alerta-error";
import { BotonDescargar } from "../_components/boton-descargar";
import { BotonImprimir } from "../_components/boton-imprimir";
import { Paginador } from "../cxc/_components/paginador";
import { TarjetaTotal } from "../cxc/_components/tarjeta-total";
import { FiltrosInventario } from "./_components/filtros-inventario";
import { TablaInventario } from "./_components/tabla-inventario";

const BASE = "/dashboard/reportes/valor-inventario";
const POR_PAGINA = 10;

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosFecha> }) {
  const params = await searchParams;
  const hoy = hoyRd();
  const hasta = leerFechaParametro(params, "hasta") ?? hoy;
  const { filas, error } = await obtenerInventario(hasta, hoy);

  const producto = leerParametro(params, "producto");
  const referencia = leerParametro(params, "referencia");
  const almacen = leerParametro(params, "almacen") || "principal";

  const filtradas = filtrarInventario(filas, { producto, referencia });
  const total = totalInventario(filtradas);
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const pagina = paginar(filtradas, leerPagina(params, totalPaginas), POR_PAGINA);

  const tabla = tablaInventario(filtradas, `Hasta: ${formatoDia(hasta)}`);
  const nombreArchivo = `valor-inventario-${hasta}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Valor de inventario</h1>
          <p className="text-muted-foreground text-sm">
            Consulta el valor actual, cantidad y costo promedio de tu inventario.
          </p>
          <p className="text-muted-foreground text-sm">Hasta: {formatoDia(hasta)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BotonDescargar tabla={tabla} nombreArchivo={nombreArchivo} />
          <BotonImprimir />
        </div>
      </div>

      <FiltrosInventario hasta={hasta} almacen={almacen} producto={producto} referencia={referencia} />

      {error ? <AlertaError mensaje={error} /> : null}

      <TarjetaTotal etiqueta="Total" total={total} />

      <Card className="py-0">
        <CardContent className="p-0">
          <TablaInventario filas={pagina.filas} />
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
