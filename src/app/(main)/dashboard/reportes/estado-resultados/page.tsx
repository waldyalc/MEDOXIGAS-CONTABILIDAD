import { z } from "zod";

import { Card, CardContent } from "@/components/ui/card";
import { getCentrosCostoActivos } from "@/lib/centros-costo/consultas";
import { obtenerEstadoResultadosComparativo } from "@/lib/reportes/estados/consultas";
import { etiquetaMes, parsearBusqueda, parsearVista, restarAnio } from "@/lib/reportes/estados/fechas";
import { type ParametrosFecha, parsearRango } from "@/lib/reportes/fechas";

import { AlertaError } from "../_components/alerta-error";
import { EncabezadoReporte } from "../_components/encabezado-reporte";
import { FiltrosEstados } from "../_components/estados/filtros-estados";
import { TablaComparativa } from "../_components/estados/tabla-comparativa";

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

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoReporte
        titulo="Estado de resultados"
        descripcion="Ingresos, costos y gastos del período comparados con el mismo período del año anterior."
        desde={desde}
        hasta={hasta}
      />

      <FiltrosEstados
        tipo="rango"
        desde={desde}
        hasta={hasta}
        vista={vista}
        busqueda={busqueda}
        centrosCosto={centrosCosto}
        centroSeleccionado={centroCostoId ?? ""}
      />

      {error ? <AlertaError mensaje={error} /> : null}

      {reporte ? (
        <Card className="py-0">
          <CardContent className="p-0">
            <TablaComparativa
              filas={reporte.filas}
              rotuloCuenta="Cuenta contable"
              rotuloActual={etiquetaMes(hasta)}
              rotuloAnterior={etiquetaMes(restarAnio(hasta))}
              rotuloPorcentaje="% de Ingresos"
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
