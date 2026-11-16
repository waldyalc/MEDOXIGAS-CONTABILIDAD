"use client";

import { useId } from "react";

import { cn } from "cn";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatearRd } from "@/lib/reportes/dinero";

export interface PuntoGraficoSerie {
  etiqueta: string;
  /** Total en centavos, como llega de los reportes. */
  total: number;
}

interface Props {
  serie: readonly PuntoGraficoSerie[];
  etiqueta?: string;
  alto?: string;
  className?: string;
}

function formatoEje(valor: number): string {
  if (Math.abs(valor) >= 1000) {
    return `RD$ ${(valor / 1000).toLocaleString("es-DO", { maximumFractionDigits: 1 })}k`;
  }

  return `RD$ ${valor.toLocaleString("es-DO", { maximumFractionDigits: 0 })}`;
}

export function GraficoAreaSerie({ serie, etiqueta = "Total", alto = "h-64", className }: Props) {
  const gradienteId = `area-${useId().replace(/:/g, "")}`;
  const datos = serie.map((punto) => ({ etiqueta: punto.etiqueta, total: punto.total / 100 }));

  const config = {
    total: { label: etiqueta, color: "var(--chart-1)" },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={config} className={cn("aspect-auto w-full", alto, className)}>
      <AreaChart accessibilityLayer data={datos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradienteId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-total)" stopOpacity={0.28} />
            <stop offset="95%" stopColor="var(--color-total)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="etiqueta" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={84}
          tickFormatter={(valor: number) => formatoEje(valor)}
        />
        <ChartTooltip
          cursor={{ stroke: "var(--border)", strokeDasharray: "3 3" }}
          content={
            <ChartTooltipContent
              indicator="line"
              formatter={(valor, nombre) => (
                <span className="flex w-full items-center justify-between gap-4">
                  <span className="text-muted-foreground">{config.total.label ?? String(nombre)}</span>
                  <span className="font-mono font-medium tabular-nums">
                    {formatearRd(Math.round(Number(valor ?? 0) * 100))}
                  </span>
                </span>
              )}
            />
          }
        />
        <Area
          dataKey="total"
          type="monotone"
          stroke="var(--color-total)"
          strokeWidth={2}
          fill={`url(#${gradienteId})`}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--background)" }}
        />
      </AreaChart>
    </ChartContainer>
  );
}
