import { CircleCheck, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { formatearRd } from "@/lib/reportes/dinero";
import { obtenerSituacionFinanciera } from "@/lib/reportes/estados/consultas";
import { etiquetaDia, parsearBusqueda, parsearHasta, parsearVista, restarAnio } from "@/lib/reportes/estados/fechas";
import type { ParametrosFecha } from "@/lib/reportes/fechas";

import { AlertaError } from "../_components/alerta-error";
import { EncabezadoReporte } from "../_components/encabezado-reporte";
import { FiltrosEstados } from "../_components/estados/filtros-estados";
import { TablaComparativa } from "../_components/estados/tabla-comparativa";

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosFecha> }) {
  const params = await searchParams;
  const hasta = parsearHasta(params);
  const vista = parsearVista(params);
  const busqueda = parsearBusqueda(params);
  const { reporte, error } = await obtenerSituacionFinanciera(hasta, {
    resumido: vista === "resumido",
    busqueda,
  });

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoReporte
        titulo="Estado de situación financiera"
        descripcion="Activos, pasivos y patrimonio a la fecha de corte, comparados con el año anterior."
        desde={hasta}
        hasta={hasta}
      />

      <FiltrosEstados tipo="fecha" hasta={hasta} vista={vista} busqueda={busqueda} />

      {error ? <AlertaError mensaje={error} /> : null}

      {reporte ? (
        <div className="flex flex-col gap-3">
          {reporte.cuadra ? (
            <Alert className="border-emerald-600/40 text-emerald-700 dark:text-emerald-400">
              <CircleCheck />
              <AlertTitle>Cuadra</AlertTitle>
              <AlertDescription>Los activos son iguales a los pasivos más el patrimonio.</AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertTitle>No cuadra</AlertTitle>
              <AlertDescription>Diferencia: {formatearRd(reporte.diferencia)}</AlertDescription>
            </Alert>
          )}

          <Card className="py-0">
            <CardContent className="p-0">
              <TablaComparativa
                filas={reporte.filas}
                rotuloCuenta="Cuenta contable"
                rotuloActual={etiquetaDia(hasta)}
                rotuloAnterior={etiquetaDia(restarAnio(hasta))}
                rotuloPorcentaje="Análisis vertical"
              />
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
