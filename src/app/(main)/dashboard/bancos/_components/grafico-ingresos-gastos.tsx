"use client";

import { cn } from "cn";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { PuntoIngresosGastos } from "@/lib/bancos/consultas";
import { centavos, formatearRd } from "@/lib/reportes/dinero";

const VERDE = "#34a853";
const ROJO = "#ea4335";

const CONFIG: ChartConfig = {
  ingresos: { label: "Ingresos", color: VERDE },
  gastos: { label: "Gastos", color: ROJO },
};

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
      <span className="text-muted-foreground">{nombre === "gastos" ? "Gastos" : "Ingresos"}</span>
      <span className="font-mono font-medium tabular-nums">{formatearRd(centavos(Number(valor ?? 0)))}</span>
    </span>
  );
}

function ItemLeyenda({ color, texto }: { color: string; texto: string }) {
  return (
    <span className="text-muted-foreground flex items-center gap-2 text-xs">
      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      {texto}
    </span>
  );
}

/** Gráfica "Ingresos y gastos" de la lista de bancos (últimos 6 meses). */
export function GraficoIngresosGastos({ serie, className }: { serie: PuntoIngresosGastos[]; className?: string }) {
  const datos = serie.map((punto) => ({
    mes: punto.mes,
    ingresos: punto.ingresosCentavos / 100,
    gastos: punto.gastosCentavos / 100,
  }));
  const hayDatos = serie.some((punto) => punto.ingresosCentavos !== 0 || punto.gastosCentavos !== 0);

  return (
    <Card className={cn("gap-4 rounded-2xl", className)}>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-[15px] font-medium">Ingresos y gastos</CardTitle>
        <span className="text-muted-foreground text-xs">Últimos 6 meses</span>
      </CardHeader>
      <CardContent>
        {hayDatos ? (
          <>
            <ChartContainer config={CONFIG} className="aspect-auto h-[220px] w-full">
              <BarChart data={datos} margin={{ top: 8, right: 8, left: 0, bottom: 4 }} barGap={4}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="mes"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
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
                  content={<ChartTooltipContent indicator="dashed" formatter={formatearTooltip} />}
                />
                <Bar dataKey="ingresos" fill="var(--color-ingresos)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="gastos" fill="var(--color-gastos)" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ChartContainer>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-3">
              <ItemLeyenda color={VERDE} texto="Ingresos" />
              <ItemLeyenda color={ROJO} texto="Gastos" />
            </div>
          </>
        ) : (
          <div className="text-muted-foreground flex h-[248px] items-center justify-center text-sm">
            Sin movimientos en los últimos 6 meses.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
