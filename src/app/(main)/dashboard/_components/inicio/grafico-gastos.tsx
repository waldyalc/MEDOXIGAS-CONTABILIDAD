"use client";

import { Cell, Pie, PieChart } from "recharts";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { DistribucionGastos } from "@/lib/inicio/calculos";
import { centavos, formatearRd } from "@/lib/reportes/dinero";

import { EstadoVacio } from "./estado-vacio";
import { TituloWidget } from "./titulo-widget";

/** Paleta del donut (rojo/azul/azul oscuro/verde/amarillo), como la referencia. */
const COLORES = ["#ef4444", "#3b82f6", "#1e3a8a", "#10b981", "#f59e0b"] as const;

const CONFIG: ChartConfig = Object.fromEntries(
  COLORES.map((color, indice) => [`gasto-${indice}`, { label: `Gasto ${indice + 1}`, color }]),
);

function formatearTooltip(valor: unknown, nombre: unknown) {
  return (
    <span className="flex w-full items-center justify-between gap-4">
      <span className="text-muted-foreground max-w-44 truncate">{String(nombre ?? "")}</span>
      <span className="font-mono font-medium tabular-nums">{formatearRd(centavos(Number(valor ?? 0)))}</span>
    </span>
  );
}

interface Props {
  gastos: DistribucionGastos;
  href: string;
}

/** Widget «Distribución de gastos»: donut del top 5 + tabla de participación. */
export function GraficoGastos({ gastos, href }: Props) {
  const hayDatos = gastos.items.length > 0;
  const datos = gastos.items.map((item, indice) => ({
    nombre: item.nombre,
    valor: item.valor / 100,
    relleno: COLORES[indice % COLORES.length],
  }));

  return (
    <Card className="ring-border gap-0 rounded-2xl [--card-spacing:--spacing(6)]">
      <CardHeader className="flex flex-col gap-0.5">
        <TituloWidget
          titulo="Distribución de gastos"
          href={href}
          tooltip="Tus cinco cuentas de gasto con más movimiento en el período."
        />
        <p className="text-muted-foreground text-xs">Tus 5 gastos más grandes del período elegido.</p>
      </CardHeader>
      <CardContent>
        {hayDatos ? (
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-10">
            <div className="relative size-44 shrink-0">
              <ChartContainer config={CONFIG} className="aspect-auto size-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent hideLabel formatter={formatearTooltip} />} />
                  <Pie
                    data={datos}
                    dataKey="valor"
                    nameKey="nombre"
                    innerRadius="72%"
                    outerRadius="100%"
                    strokeWidth={2}
                    paddingAngle={2}
                  >
                    {datos.map((item) => (
                      <Cell key={item.nombre} fill={item.relleno ?? COLORES[0]} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                <span className="text-muted-foreground text-xs">Total</span>
                <span className="text-foreground text-base font-semibold tabular-nums">
                  {formatearRd(gastos.total)}
                </span>
              </div>
            </div>
            <div className="w-full min-w-0 flex-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground text-left text-[11px] font-medium tracking-wide">
                    <th className="pb-2 font-medium">Concepto</th>
                    <th className="pb-2 text-right font-medium">Valor</th>
                    <th className="w-20 pb-2 text-right font-medium">Participación</th>
                  </tr>
                </thead>
                <tbody>
                  {gastos.items.map((item, indice) => (
                    <tr key={item.nombre} className="border-border/60 border-t">
                      <td className="py-2.5 pr-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: COLORES[indice % COLORES.length] }}
                            aria-hidden="true"
                          />
                          <span className="truncate">{item.nombre}</span>
                        </span>
                      </td>
                      <td className="py-2.5 text-right whitespace-nowrap tabular-nums">{formatearRd(item.valor)}</td>
                      <td className="text-muted-foreground py-2.5 text-right tabular-nums">
                        {item.participacion.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EstadoVacio
            className="h-[220px]"
            titulo="Sin gastos registrados"
            detalle="No registraste gastos en este período."
          />
        )}
      </CardContent>
    </Card>
  );
}
