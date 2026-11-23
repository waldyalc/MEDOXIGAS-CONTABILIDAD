import { z } from "zod";

import { Card, CardContent } from "@/components/ui/card";
import { getCentrosCostoActivos } from "@/lib/centros-costo/consultas";
import { obtenerEstadoResultadosComparativo } from "@/lib/reportes/estados/consultas";
import { etiquetaMes, parsearBusqueda, parsearVista, restarAnio } from "@/lib/reportes/estados/fechas";
import { generarResumenResultados } from "@/lib/reportes/estados/resumen";
import { type ParametrosFecha, parsearRango } from "@/lib/reportes/fechas";

import { AlertaError } from "../_components/alerta-error";
import { BotonDescargar } from "../_components/boton-descargar";
import { EncabezadoReporte } from "../_components/encabezado-reporte";
import { EncabezadoTablaComparativa, type ParametroOculto } from "../_components/estados/encabezado-tabla-comparativa";
import { FiltrosEstados } from "../_components/estados/filtros-estados";
import { TablaComparativa } from "../_components/estados/tabla-comparativa";
import { tablaEstadoResultados } from "./_components/exportar";
import { ResumenEstado } from "./_components/resumen-estado";
import { rotuloComparativo } from "./_components/rotulo-comparativo";

const RUTA = "/dashboard/reportes/estado-resultados";

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosFecha> }) {
  const params = await searchParams;
  const { desde, hasta } = parsearRango(params);
  const vista = parsearVista(params);
  const busqueda = parsearBusqueda(params);
  const centroParam = Array.isArray(params.centro) ? params.centro[0] : params.centro;
  const centroCostoId = centroParam && z.uuid().safeParse(centroParam).success ? centroParam : null;
  const [centrosCosto, { reporte, error }] = await Promise.all([
    getCentrosCostoActivos(),
    obtenerEstadoResultadosComparativo(desde, hasta, {
      resumido: vista === "resumido",
      busqueda,
      centroCostoId,
    }),
  ]);

  const rotuloActual = etiquetaMes(hasta);
  const rotuloAnterior = etiquetaMes(restarAnio(hasta));
  const rotuloPorcentaje = "% de Ingresos";
  const etiquetaRango = rotuloComparativo(desde, hasta);
  const parametros: ParametroOculto[] = [
    { nombre: "desde", valor: desde },
    { nombre: "hasta", valor: hasta },
    { nombre: "vista", valor: vista },
    ...(centroCostoId == null ? [] : [{ nombre: "centro", valor: centroCostoId }]),
  ];
  const tabla =
    reporte == null
      ? null
      : tablaEstadoResultados(
          reporte.filas,
          { cuenta: "Cuenta contable", actual: rotuloActual, anterior: rotuloAnterior, porcentaje: rotuloPorcentaje },
          etiquetaRango,
        );

  return (
    <div className="flex flex-col gap-5">
      <EncabezadoReporte
        titulo="Estado de resultados"
        descripcion="Conoce tu desempeño financiero y obtén insumos para tomar decisiones inteligentes."
        migas={[
          { etiqueta: "Reportes", href: "/dashboard/reportes" },
          { etiqueta: "Contables", href: "/dashboard/reportes" },
          { etiqueta: "Estado de resultados" },
        ]}
        acciones={
          tabla == null ? undefined : (
            <BotonDescargar tabla={tabla} nombreArchivo={`estado-resultados-${desde}-${hasta}`} />
          )
        }
        mostrarImprimir={false}
      />

      <FiltrosEstados
        tipo="rango"
        desde={desde}
        hasta={hasta}
        vista={vista}
        busqueda={busqueda}
        centrosCosto={centrosCosto}
        centroSeleccionado={centroCostoId ?? ""}
        ocultarBusqueda
      />

      {error ? <AlertaError mensaje={error} /> : null}

      {reporte ? <ResumenEstado texto={generarResumenResultados(reporte.filas)} /> : null}

      {reporte ? (
        <Card className="gap-0 py-0">
          <CardContent className="p-0">
            <EncabezadoTablaComparativa
              accion={RUTA}
              etiquetaRango={etiquetaRango}
              busqueda={busqueda}
              parametros={parametros}
            />
            <TablaComparativa
              filas={reporte.filas}
              rotuloCuenta="Cuenta contable"
              rotuloActual={rotuloActual}
              rotuloAnterior={rotuloAnterior}
              rotuloPorcentaje={rotuloPorcentaje}
              expandible
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
