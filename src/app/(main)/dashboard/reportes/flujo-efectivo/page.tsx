import { Info } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { obtenerFlujoEfectivo } from "@/lib/reportes/estados/consultas";
import { etiquetaMes, parsearBusqueda, periodoAnterior } from "@/lib/reportes/estados/fechas";
import { type ParametrosFecha, parsearRango } from "@/lib/reportes/fechas";

import { AlertaError } from "../_components/alerta-error";
import { EncabezadoReporte } from "../_components/encabezado-reporte";
import { FiltrosEstados } from "../_components/estados/filtros-estados";
import { TablaComparativa } from "../_components/estados/tabla-comparativa";

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosFecha> }) {
  const params = await searchParams;
  const { desde, hasta } = parsearRango(params);
  const busqueda = parsearBusqueda(params);
  const { reporte, error } = await obtenerFlujoEfectivo(desde, hasta, { busqueda });
  const anterior = periodoAnterior(desde, hasta);

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoReporte
        titulo="Estado de flujo de efectivo"
        descripcion="Entradas y salidas de efectivo por operación, inversión y financiación mediante el método indirecto."
        desde={desde}
        hasta={hasta}
      />

      <FiltrosEstados tipo="rango" desde={desde} hasta={hasta} busqueda={busqueda} />

      {error ? <AlertaError mensaje={error} /> : null}

      {reporte && reporte.conceptosSinCuentas.length > 0 ? (
        <Alert>
          <Info />
          <AlertTitle>Conceptos sin cuentas contables asociadas</AlertTitle>
          <AlertDescription>
            Tienes {reporte.conceptosSinCuentas.length} conceptos sin cuentas contables asociadas:{" "}
            {reporte.conceptosSinCuentas.join(", ")}.
          </AlertDescription>
        </Alert>
      ) : null}

      {reporte ? (
        <Card className="py-0">
          <CardContent className="p-0">
            <TablaComparativa
              filas={reporte.filas}
              rotuloCuenta="Concepto"
              rotuloActual={etiquetaMes(hasta)}
              rotuloAnterior={etiquetaMes(anterior.hasta)}
              rotuloPorcentaje="Análisis vertical"
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
