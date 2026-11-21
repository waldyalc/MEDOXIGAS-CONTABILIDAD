"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { TrendingDown, TrendingUp } from "@/components/icons";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { FlujoTransacciones } from "@/lib/inicio/calculos";
import { centavos, formatearRd } from "@/lib/reportes/dinero";

import { EstadoVacio } from "./estado-vacio";
import { TituloWidget } from "./titulo-widget";

const VERDE = "#34d399";
const ROJO = "#ef4444";

const CONFIG: ChartConfig = {
  ingresos: { label: "Ingresos", color: VERDE },
  egresos: { label: "Egresos", color: ROJO },
};

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function fechaCorta(iso: string): string {
  const mes = Number(iso.slice(5, 7));
  return `${Number(iso.slice(8, 10))} ${MESES[mes - 1] ?? ""}`;
}

function formatoEje(valor: number): string {
  if (valor === 0) return "RD$0";
  if (Math.abs(valor) >= 1000) {
    return `RD$${(valor / 1000).toLocaleString("es-DO", { maximumFractionDigits: 1 })} K`;
  }
  return `RD$${valor.toLocaleString("es-DO", { maximumFractionDigits: 0 })}`;
}

function formatearTooltip(valor: unknown, nombre: unknown) {
  return (
    <span className="flex w-full items-center justify-between gap-4">
      <span className="text-muted-foreground">{nombre === "egresos" ? "Egresos" : "Ingresos"}</span>
      <span className="font-mono font-medium tabular-nums">{formatearRd(centavos(Number(valor ?? 0)))}</span>
    </span>
  );
}

function TextoVariacion({ variacion }: { variacion: number | null }) {
  if (variacion == null) {
    return <span className="text-muted-foreground text-sm font-normal">—</span>;
  }

  let Icono: typeof TrendingUp | null = null;
  let color = "text-muted-foreground";
  if (variacion > 0) {
    Icono = TrendingUp;
    color = "text-emerald-600 dark:text-emerald-400";
  } else if (variacion < 0) {
    Icono = TrendingDown;
    color = "text-red-600 dark:text-red-400";
  }

  return (
    <span className={`flex items-center gap-0.5 text-sm font-normal ${color}`}>
      {Icono ? <Icono className="size-4" aria-hidden="true" /> : null}
      {Math.abs(variacion).toLocaleString("es-DO", { maximumFractionDigits: 1 })}%
      <span className="sr-only">contra el período anterior</span>
    </span>
  );
}

function TotalLateral({ etiqueta, total, variacion }: { etiqueta: string; total: number; variacion: number | null }) {
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className="text-muted-foreground text-xs">{etiqueta}</span>
      <span className="flex items-baseline gap-2">
        <span className="text-foreground text-xl leading-7 font-normal tracking-tight tabular-nums">
          {formatearRd(total)}
        </span>
        <TextoVariacion variacion={variacion} />
      </span>
    </div>
  );
}

interface Props {
  flujo: FlujoTransacciones;
  href: string;
}

/** Widget «Flujo de transacciones»: barras de ingresos/egresos por día. */
export function GraficoFlujo({ flujo, href }: Props) {
  const datos = flujo.puntos.map((punto) => ({
    fecha: punto.fecha,
    ingresos: punto.ingresos / 100,
    egresos: punto.egresos / 100,
  }));
  const hayDatos = datos.length > 0;

  return (
    <Card className="ring-border gap-0 rounded-2xl [--card-spacing:--spacing(6)]">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <TituloWidget
            titulo="Flujo de transacciones"
            href={href}
            tooltip="Entradas y salidas de tus cuentas de banco y caja en el período, impuestos incluidos."
          />
          <p className="text-muted-foreground text-xs">
            Movimiento de tus cuentas durante el período elegido, impuestos incluidos.
          </p>
        </div>
        <div className="flex items-start gap-8">
          <TotalLateral etiqueta="Total ingresos" total={flujo.totalIngresos} variacion={flujo.variacionIngresos} />
          <TotalLateral etiqueta="Total egresos" total={flujo.totalEgresos} variacion={flujo.variacionEgresos} />
        </div>
      </CardHeader>
      <CardContent className="pb-0">
        {hayDatos ? (
          <>
            <ChartContainer config={CONFIG} className="aspect-auto h-[240px] w-full">
              <BarChart data={datos} margin={{ top: 8, right: 8, left: 0, bottom: 4 }} barGap={4}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="fecha"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  tickFormatter={fechaCorta}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  width={78}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  tickFormatter={formatoEje}
                />
                <ChartTooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.35 }}
                  content={
                    <ChartTooltipContent
                      indicator="dashed"
                      formatter={formatearTooltip}
                      labelFormatter={(etiqueta) => fechaCorta(String(etiqueta))}
                    />
                  }
                />
                <Bar dataKey="ingresos" fill="var(--color-ingresos)" radius={[3, 3, 0, 0]} maxBarSize={56} />
                <Bar dataKey="egresos" fill="var(--color-egresos)" radius={[3, 3, 0, 0]} maxBarSize={56} />
              </BarChart>
            </ChartContainer>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-3">
              <span className="text-muted-foreground flex items-center gap-2 text-xs">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: VERDE }}
                  aria-hidden="true"
                />
                Ingresos
              </span>
              <span className="text-muted-foreground flex items-center gap-2 text-xs">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: ROJO }} aria-hidden="true" />
                Egresos
              </span>
            </div>
          </>
        ) : (
          <EstadoVacio
            className="h-[240px]"
            titulo="Sin transacciones registradas"
            detalle="No hubo movimientos en tus cuentas durante este período."
          />
        )}
      </CardContent>
    </Card>
  );
}
