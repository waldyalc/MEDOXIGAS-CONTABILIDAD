"use client";

import Link from "next/link";

import { Info, TrendingDown, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatoDia } from "@/lib/formato";
import type { PuntoSerieVentas, ResumenNegocio } from "@/lib/inicio/consultas";
import { centavos, formatearRd } from "@/lib/reportes/dinero";

const AZUL = "#3b5bdb";
const VERDE = "#2fd0a0";

const CONFIG: ChartConfig = {
  actual: { label: "Periodo actual", color: AZUL },
  anterior: { label: "Año anterior", color: VERDE },
};

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function partesFecha(iso: string): { anio: number; mes: number; dia: number } {
  return {
    anio: Number(iso.slice(0, 4)),
    mes: Number(iso.slice(5, 7)),
    dia: Number(iso.slice(8, 10)),
  };
}

function fechaLarga(iso: string): string {
  const { anio, mes, dia } = partesFecha(iso);
  return `${dia} ${MESES[mes - 1] ?? ""} de ${anio}`;
}

function restarUnAnio(iso: string): string {
  const { anio, mes, dia } = partesFecha(iso);
  const ultimoDia = new Date(Date.UTC(anio - 1, mes, 0)).getUTCDate();
  return `${anio - 1}-${String(mes).padStart(2, "0")}-${String(Math.min(dia, ultimoDia)).padStart(2, "0")}`;
}

function etiquetaEje(iso: string, diario: boolean): string {
  const { anio, mes, dia } = partesFecha(iso);
  const nombreMes = MESES[mes - 1] ?? "";

  return diario ? `${dia} ${nombreMes}` : `${nombreMes} ${anio}`;
}

function etiquetaTooltip(iso: string, diario: boolean): string {
  return diario ? formatoDia(iso) : etiquetaEje(iso, false);
}

function formatoEje(valor: number): string {
  if (valor === 0) return "RD$0";

  if (Math.abs(valor) >= 1000) {
    const miles = valor / 1000;
    return `RD$${miles.toLocaleString("es-DO", { maximumFractionDigits: 1 })} K`;
  }

  return `RD$${valor.toLocaleString("es-DO", { maximumFractionDigits: 0 })}`;
}

function formatearTooltip(valor: unknown, nombre: unknown) {
  const etiqueta = nombre === "anterior" ? "Año anterior" : "Periodo actual";

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
}

function Grafico({ datos, esDiario }: GraficoProps) {
  const comunes = (
    <>
      <CartesianGrid vertical={false} stroke="var(--border)" />
      <XAxis
        dataKey="etiqueta"
        tickLine={false}
        axisLine={false}
        tickMargin={10}
        minTickGap={8}
        tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
        tickFormatter={(valor: string) => etiquetaEje(valor, esDiario)}
      />
      <YAxis
        tickLine={false}
        axisLine={false}
        tickMargin={8}
        width={82}
        tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
        tickFormatter={(valor: number) => formatoEje(valor)}
      />
      <ChartTooltip
        cursor={false}
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
    <ChartContainer config={CONFIG} className="aspect-auto h-[260px] w-full">
      {esDiario ? (
        <LineChart data={datos as PuntoSerieVentas[]} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
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
            strokeDasharray="4 3"
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      ) : (
        <BarChart data={datos as PuntoSerieVentas[]} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
          {comunes}
          <Bar dataKey="actual" fill="var(--color-actual)" maxBarSize={56} radius={[4, 4, 0, 0]} />
        </BarChart>
      )}
    </ChartContainer>
  );
}

interface ItemLeyendaProps {
  color: string;
  texto: string;
}

function ItemLeyenda({ color, texto }: ItemLeyendaProps) {
  return (
    <span className="text-muted-foreground flex items-center gap-2 text-xs">
      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      {texto}
    </span>
  );
}

interface Props {
  resumen: ResumenNegocio;
  href: string;
}

export function GraficoVentasResumen({ resumen, href }: Props) {
  const { ventas, es_diario, desde, hasta } = resumen;
  const variacion = ventas.variacion;
  const hayDatos = ventas.serie.some((punto) => Number(punto.actual) > 0 || Number(punto.anterior) > 0);
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

  const textoVariacion =
    variacion == null ? "—" : `${Math.abs(variacion).toLocaleString("es-DO", { maximumFractionDigits: 1 })}%`;

  return (
    <Card className="gap-4 rounded-[10px] py-5 ring-[#e2e8f0] dark:ring-border">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 px-5">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <CardTitle className="text-[15px] font-medium text-[#3c4257] dark:text-slate-300">
              <Link
                href={href}
                className="hover:text-primary underline decoration-[#b8c2cf] underline-offset-[3px] dark:decoration-slate-600"
              >
                Total de ventas
              </Link>
            </CardTitle>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground"
                    aria-label="Más información sobre la gráfica de ventas"
                  />
                }
              >
                <Info aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent>
                Ventas registradas en el periodo seleccionado, con sus impuestos incluidos.
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="text-muted-foreground text-[13px]">
            Comportamiento de tus ventas durante el periodo elegido, impuestos incluidos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-2xl leading-8 font-semibold tracking-tight text-slate-900 tabular-nums dark:text-foreground">
            {formatearRd(centavos(ventas.total))}
          </p>
          {variacion == null ? null : (
            <span className={`flex items-center gap-0.5 text-xs font-medium ${colorVariacion}`}>
              {Icono ? <Icono className="size-3.5" aria-hidden="true" /> : null}
              {textoVariacion}
              <span className="sr-only">contra el año anterior</span>
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-0">
        {hayDatos ? (
          <>
            <Grafico datos={ventas.serie} esDiario={es_diario} />
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-4">
              <ItemLeyenda color={AZUL} texto={`${fechaLarga(desde)} - ${fechaLarga(hasta)}`} />
              {es_diario ? (
                <ItemLeyenda
                  color={VERDE}
                  texto={`${fechaLarga(restarUnAnio(desde))} - ${fechaLarga(restarUnAnio(hasta))}`}
                />
              ) : null}
            </div>
          </>
        ) : (
          <div className="text-muted-foreground flex h-[292px] items-center justify-center text-sm">
            Sin ventas registradas en el periodo.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
