import { Card, CardContent } from "@/components/ui/card";
import { formatoDia } from "@/lib/formato";
import { leerTamanoConDefecto } from "@/lib/listas/parametros";
import { obtenerInventario } from "@/lib/reportes/administrativos/d/consultas";
import { tablaInventario } from "@/lib/reportes/administrativos/d/exportar";
import { filtrarInventario, totalInventario } from "@/lib/reportes/administrativos/d/inventario";
import { leerFechaParametro, leerPagina, leerParametro, paginar } from "@/lib/reportes/administrativos/d/parametros";
import { hoyRd, type ParametrosFecha } from "@/lib/reportes/fechas";

import { AlertaError } from "../_components/alerta-error";
import { BotonDescargar } from "../_components/boton-descargar";
import { EncabezadoReporte } from "../_components/encabezado-reporte";
import { Paginador } from "../cxc/_components/paginador";
import { TarjetaTotal } from "../cxc/_components/tarjeta-total";
import { FiltrosInventario } from "./_components/filtros-inventario";
import { TablaInventario } from "./_components/tabla-inventario";

const BASE = "/dashboard/reportes/valor-inventario";
const TAMANO_DEFECTO = 20;

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
  const tamano = leerTamanoConDefecto(params, TAMANO_DEFECTO);
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / tamano));
  const pagina = paginar(filtradas, leerPagina(params, totalPaginas), tamano);

  const tabla = tablaInventario(filtradas, `Hasta: ${formatoDia(hasta)}`);
  const nombreArchivo = `valor-inventario-${hasta}`;

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoReporte
        titulo="Valor de inventario"
        descripcion="Consulta el valor actual, cantidad y costo promedio de tu inventario."
        rango={`Hasta: ${formatoDia(hasta)}`}
        acciones={<BotonDescargar tabla={tabla} nombreArchivo={nombreArchivo} />}
      />

      <FiltrosInventario hasta={hasta} almacen={almacen} producto={producto} referencia={referencia} />

      {error ? <AlertaError mensaje={error} /> : null}

      <TarjetaTotal etiqueta="Total" total={total} />

      <Card className="py-0">
        <CardContent className="p-0">
          <TablaInventario filas={pagina.filas} />
          <Paginador
            base={BASE}
            params={params}
            pagina={pagina.pagina}
            totalPaginas={pagina.totalPaginas}
            inicio={pagina.inicio}
            fin={pagina.fin}
            total={pagina.total}
            tamano={tamano}
          />
        </CardContent>
      </Card>
    </div>
  );
}
