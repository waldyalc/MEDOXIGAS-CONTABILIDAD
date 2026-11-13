"use client";

import Link from "next/link";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatearRd } from "@/lib/reportes/dinero";
import type { Periodicidad, PuntoSerieVentas } from "@/lib/reportes/ventas/v1/tipos";

const CONFIG: ChartConfig = {
  total: { label: "Después de impuestos", color: "var(--chart-2)" },
};

interface Props {
  serie: PuntoSerieVentas[];
  grafico: Periodicidad;
  hrefDiario: string;
  hrefMensual: string;
}

function formatoEje(valor: number): string {
  if (Math.abs(valor) >= 1000) {
    return `RD$ ${(valor / 1000).toLocaleString("es-DO", { maximumFractionDigits: 1 })}k`;
  }

  return `RD$ ${valor.toLocaleString("es-DO", { maximumFractionDigits: 0 })}`;
}

export function GraficoVentas({ serie, grafico, hrefDiario, hrefMensual }: Props) {
  const datos = serie.map((punto) => ({ etiqueta: punto.etiqueta, total: punto.total / 100 }));

  return (
    <Card className="py-0">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 py-4">
        <CardTitle>Ventas</CardTitle>
        <div className="flex items-center gap-1 print:hidden">
          <Button size="sm" variant={grafico === "diario" ? "secondary" : "ghost"} render={<Link href={hrefDiario} />}>
            Diario
          </Button>
          <Button
            size="sm"
            variant={grafico === "mensual" ? "secondary" : "ghost"}
            render={<Link href={hrefMensual} />}
          >
            Mensual
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-4">
        {datos.length === 0 ? (
          <p className="text-muted-foreground py-12 text-center text-sm">No hay ventas en el período.</p>
        ) : (
          <ChartContainer config={CONFIG} className="aspect-auto h-64 w-full">
            <BarChart data={datos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="etiqueta" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={84}
                tickFormatter={(valor: number) => formatoEje(valor)}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent formatter={(valor) => formatearRd(Math.round(Number(valor ?? 0) * 100))} />
                }
              />
              <Bar dataKey="total" fill="var(--color-total)" maxBarSize={56} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
