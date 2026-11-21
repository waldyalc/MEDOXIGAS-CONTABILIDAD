"use client";

import Link from "next/link";

import { CartesianGrid, Line, LineChart } from "recharts";

import { Info, TrendingDown, TrendingUp } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatoDia } from "@/lib/formato";
import type { PuntoSerieVentas, ResumenNegocio } from "@/lib/inicio/consultas";
import { centavos, formatearRd } from "@/lib/reportes/dinero";

const CONFIG: ChartConfig = {
  actual: { label: "Periodo actual", color: "var(--chart-1)" },
  anterior: { label: "Año anterior", color: "var(--color-emerald-400)" },
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

function etiquetaTooltip(iso: string, diario: boolean): string {
  if (diario) return formatoDia(iso);
  const { anio, mes } = partesFecha(iso);
  return `${MESES[mes - 1] ?? ""} ${anio}`;
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
  return (
    <ChartContainer config={CONFIG} className="aspect-auto h-[260px] w-full">
      <LineChart data={datos as PuntoSerieVentas[]} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
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
    <Card className="ring-border gap-0 rounded-2xl [--card-spacing:--spacing(6)]">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <CardTitle className="text-foreground text-sm font-semibold">
              <Link href={href} className="hover:text-primary decoration-border underline underline-offset-[3px]">
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
          <p className="text-muted-foreground text-xs">
            Comportamiento de tus ventas durante el periodo elegido, impuestos incluidos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-foreground text-xl leading-7 font-normal tracking-tight tabular-nums">
            {formatearRd(centavos(ventas.total))}
          </p>
          <span className={`flex items-center gap-0.5 text-sm font-normal ${colorVariacion}`}>
            {Icono ? <Icono className="size-4" aria-hidden="true" /> : null}
            {textoVariacion}
            <span className="sr-only">contra el año anterior</span>
          </span>
        </div>
      </CardHeader>
      <CardContent className="pb-0">
        {hayDatos ? (
          <>
            <Grafico datos={ventas.serie} esDiario={es_diario} />
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-4">
              <ItemLeyenda color="var(--chart-1)" texto={`${fechaLarga(desde)} - ${fechaLarga(hasta)}`} />
              <ItemLeyenda
                color="var(--color-emerald-400)"
                texto={`${fechaLarga(restarUnAnio(desde))} - ${fechaLarga(restarUnAnio(hasta))}`}
              />
            </div>
          </>
        ) : (
          <div className="text-muted-foreground flex h-[260px] items-center justify-center text-sm">
            Sin ventas registradas en el periodo.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
