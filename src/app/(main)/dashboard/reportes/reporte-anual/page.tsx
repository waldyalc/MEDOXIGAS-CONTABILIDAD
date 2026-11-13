import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { rutaContacto, rutaProducto } from "@/lib/enlaces";
import {
  calcularReporteAnual,
  type FilaParticipacionAnual,
  formatearPorcentajeAnual,
} from "@/lib/reportes/administrativos/e/anual";
import { obtenerDatosReporteAnual } from "@/lib/reportes/administrativos/e/consultas";
import { tablaAnual } from "@/lib/reportes/administrativos/e/tablas";
import { URL_REGISTRAR_VENTA } from "@/lib/reportes/administrativos/e/urls";
import { formatearRd } from "@/lib/reportes/dinero";
import { hoyRd, type ParametrosFecha } from "@/lib/reportes/fechas";

import { AlertaError } from "../_components/alerta-error";
import { BotonDescargar } from "../_components/boton-descargar";
import { EncabezadoReporte } from "../_components/encabezado-reporte";
import { FiltrosAnual } from "./_components/filtros-anual";
import { GraficoVentasAnual } from "./_components/grafico-ventas-anual";
import { TarjetaRanking } from "./_components/tarjeta-ranking";

interface TarjetaResumen {
  titulo: string;
  valor: string;
  negativo: boolean;
}

function leerParametro(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

function leerAnio(valor: string | undefined, anioActual: number): number {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero >= 2000 && numero <= anioActual ? numero : anioActual;
}

function filaRanking(fila: FilaParticipacionAnual, href: string | null) {
  return {
    id: fila.id,
    nombre: fila.nombre,
    monto: fila.monto,
    participacion: fila.participacion,
    href,
  };
}

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosFecha> }) {
  const parametros = await searchParams;
  const hoy = hoyRd();
  const anioActual = Number(hoy.slice(0, 4));
  const anio = leerAnio(leerParametro(parametros.anio), anioActual);
  const comparar = leerParametro(parametros.comparar) !== "0";
  const desde = `${anio}-01-01`;
  const hasta = anio === anioActual ? hoy : `${anio}-12-31`;

  const { datos, error } = await obtenerDatosReporteAnual(anio);
  const reporte = calcularReporteAnual({ anio, hoy, comparar, ...datos });
  const resumen = reporte.resumen;

  const filasProductos = reporte.productos.map((fila) =>
    filaRanking(fila, fila.id === null ? null : rutaProducto(fila.id)),
  );
  const filasClientes = reporte.clientes.map((fila) =>
    filaRanking(fila, fila.id === null ? null : rutaContacto(fila.id)),
  );
  const filasGastos = reporte.gastos.map((fila) => filaRanking(fila, null));

  const totalProductos = reporte.productos.reduce((total, fila) => total + fila.monto, 0);
  const totalClientes = reporte.clientes.reduce((total, fila) => total + fila.monto, 0);
  const participacionProductos = resumen.ventas > 0 ? (totalProductos / resumen.ventas) * 100 : 0;
  const participacionClientes = resumen.ventas > 0 ? (totalClientes / resumen.ventas) * 100 : 0;

  const tarjetas: TarjetaResumen[] = [
    { titulo: "Promedio mensual de ventas", valor: formatearRd(resumen.promedioMensual), negativo: false },
    { titulo: "Promedio semanal", valor: formatearRd(resumen.promedioSemanal), negativo: false },
    { titulo: "Promedio diario", valor: formatearRd(resumen.promedioDiario), negativo: false },
    { titulo: "Ventas", valor: formatearRd(resumen.ventas), negativo: false },
    { titulo: "Costos y gastos", valor: formatearRd(resumen.costosYGastos), negativo: false },
    { titulo: "Utilidad neta", valor: formatearRd(resumen.utilidadNeta), negativo: resumen.utilidadNeta < 0 },
    {
      titulo: "Margen neto (%)",
      valor: formatearPorcentajeAnual(resumen.margenNeto),
      negativo: resumen.margenNeto < 0,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoReporte
        titulo="Reporte anual"
        descripcion="Resumen de ventas, costos, gastos y rankings del año."
        desde={desde}
        hasta={hasta}
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <FiltrosAnual anio={anio} anioActual={anioActual} comparar={comparar} />
        <BotonDescargar tabla={tablaAnual(reporte, anio, comparar)} nombreArchivo={`reporte-anual-${anio}`} />
      </div>

      {error ? <AlertaError mensaje={error} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tarjetas.map((tarjeta) => (
          <Card key={tarjeta.titulo} size="sm">
            <CardHeader>
              <CardTitle className="text-muted-foreground font-normal">{tarjeta.titulo}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-semibold tabular-nums ${tarjeta.negativo ? "text-destructive" : ""}`}>
                {tarjeta.valor}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ventas del año</CardTitle>
          <CardDescription>
            {comparar
              ? `Comparación de las ventas netas de ${anio} con ${anio - 1}.`
              : `Ventas netas de ${anio} por mes y por día.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GraficoVentasAnual
            serieMensual={reporte.serieMensual}
            serieDiaria={reporte.serieDiaria}
            resumen={resumen}
            anio={anio}
            comparar={comparar}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <TarjetaRanking
          titulo="Productos/Servicios más vendidos"
          descripcion={`${formatearRd(totalProductos)} (${formatearPorcentajeAnual(participacionProductos)})`}
          columnaNombre="Producto/servicio"
          filas={filasProductos}
        />
        <TarjetaRanking
          titulo="Mejores clientes"
          descripcion={`${formatearRd(totalClientes)} (${formatearPorcentajeAnual(participacionClientes)})`}
          columnaNombre="Cliente"
          filas={filasClientes}
        />
        <TarjetaRanking
          titulo="Principales gastos"
          descripcion={`${formatearRd(reporte.gastosTotales)} · ${formatearPorcentajeAnual(
            reporte.participacionGastosEnVentas,
          )} de las ventas`}
          columnaNombre="Concepto"
          filas={filasGastos}
        />

        <Card>
          <CardHeader>
            <CardTitle>Mejores vendedores</CardTitle>
            <CardDescription>Ranking de vendedores del año.</CardDescription>
          </CardHeader>
          <CardContent>
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>Sin vendedores destacados</EmptyTitle>
              </EmptyHeader>
              <Button render={<Link href={URL_REGISTRAR_VENTA} />}>Registrar venta</Button>
            </Empty>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
