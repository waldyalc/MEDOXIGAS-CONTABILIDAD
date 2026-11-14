"use client";

import Link from "next/link";

import { Maximize2, TrendingDown, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatoDia, formatoPct } from "@/lib/formato";
import type { PuntoSerieVentas, ResumenNegocio } from "@/lib/inicio/consultas";
import { centavos, formatearRd } from "@/lib/reportes/dinero";

const CONFIG: ChartConfig = {
  actual: { label: "Este periodo", color: "var(--chart-1)" },
  anterior: { label: "Año anterior", color: "var(--chart-4)" },
};

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function etiquetaEje(iso: string, diario: boolean): string {
  const [anio, mes, dia] = iso.split("-");
  const nombreMes = MESES[Number(mes) - 1] ?? "";

  return diario ? `${Number(dia)} ${nombreMes}` : `${nombreMes} ${anio}`;
}

function etiquetaTooltip(iso: string, diario: boolean): string {
  return diario ? formatoDia(iso) : etiquetaEje(iso, false);
}

function formatoEje(valor: number): string {
  if (Math.abs(valor) >= 1000) {
    return `RD$ ${(valor / 1000).toLocaleString("es-DO", { maximumFractionDigits: 1 })}k`;
  }

  return `RD$ ${valor.toLocaleString("es-DO", { maximumFractionDigits: 0 })}`;
}

function formatearTooltip(valor: unknown, nombre: unknown) {
  const etiqueta = nombre === "anterior" ? "Año anterior" : "Este periodo";

  return (
    <span className="flex w-full items-center justify-between gap-4">
      <span className="text-muted-foreground">{etiqueta}</span>
      <span className="font-mono font-medium tabular-nums">{formatearRd(centavos(Number(valor ?? 0)))}</span>
    </span>
  );
}

interface GraficoProps {
  datos: readonly PuntoSerieVentas[];
  esDiario: boolean;
  alto: string;
}

function Grafico({ datos, esDiario, alto }: GraficoProps) {
  const comunes = (
    <>
      <CartesianGrid vertical={false} />
      <XAxis
        dataKey="etiqueta"
        tickLine={false}
        axisLine={false}
        tickMargin={8}
        minTickGap={16}
        tickFormatter={(valor: string) => etiquetaEje(valor, esDiario)}
      />
      <YAxis
        tickLine={false}
        axisLine={false}
        tickMargin={8}
        width={84}
        tickFormatter={(valor: number) => formatoEje(valor)}
      />
      <ChartTooltip
        content={
          <ChartTooltipContent
            indicator="line"
            labelFormatter={(valor) => etiquetaTooltip(String(valor), esDiario)}
            formatter={formatearTooltip}
          />
        }
      />
    </>
  );

  return (
    <ChartContainer config={CONFIG} className={`aspect-auto ${alto} w-full`}>
      {esDiario ? (
        <LineChart data={datos as PuntoSerieVentas[]} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          {comunes}
          <Line
            dataKey="actual"
            type="monotone"
            stroke="var(--color-actual)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            dataKey="anterior"
            type="monotone"
            stroke="var(--color-anterior)"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            activeDot={{ r: 4 }}
          />
          <ChartLegend content={<ChartLegendContent />} />
        </LineChart>
      ) : (
        <BarChart data={datos as PuntoSerieVentas[]} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          {comunes}
          <Bar dataKey="actual" fill="var(--color-actual)" maxBarSize={56} radius={[4, 4, 0, 0]} />
        </BarChart>
      )}
    </ChartContainer>
  );
}

interface Props {
  resumen: ResumenNegocio;
  href: string;
}

export function GraficoVentasResumen({ resumen, href }: Props) {
  const { ventas, es_diario } = resumen;
  const variacion = ventas.variacion;
  let Icono: typeof TrendingUp | null = null;
  let colorVariacion = "text-muted-foreground";

  if (variacion != null && variacion !== 0) {
    if (variacion > 0) {
      Icono = TrendingUp;
      colorVariacion = "text-emerald-600 dark:text-emerald-400";
    } else {
      Icono = TrendingDown;
      colorVariacion = "text-red-600 dark:text-red-400";
    }
  }

  const textoVariacion = variacion == null ? "—" : `${variacion > 0 ? "+" : ""}${formatoPct(variacion)}`;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle>
            <Link href={href} className="hover:text-primary underline-offset-4 hover:underline">
              Total de ventas
            </Link>
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            La gráfica muestra el valor de tus ventas con impuestos incluidos.
          </p>
        </div>
        <div className="flex items-start gap-2">
          <div className="text-right">
            <p className="text-2xl font-semibold tabular-nums">{formatearRd(centavos(ventas.total))}</p>
            <p className={`flex items-center justify-end gap-1 text-xs font-medium ${colorVariacion}`}>
              {Icono ? <Icono className="size-3.5" aria-hidden="true" /> : null}
              {textoVariacion}
              <span className="text-muted-foreground font-normal">vs. año anterior</span>
            </p>
          </div>
          <Dialog>
            <DialogTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground"
                  aria-label="Expandir gráfica"
                />
              }
            >
              <Maximize2 />
            </DialogTrigger>
            <DialogContent className="sm:max-w-5xl">
              <DialogHeader>
                <DialogTitle>Total de ventas</DialogTitle>
                <DialogDescription>
                  La gráfica muestra el valor de tus ventas con impuestos incluidos.
                </DialogDescription>
              </DialogHeader>
              <Grafico datos={ventas.serie} esDiario={es_diario} alto="h-[60vh]" />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-4">
        <Grafico datos={ventas.serie} esDiario={es_diario} alto="h-64" />
      </CardContent>
    </Card>
  );
}
