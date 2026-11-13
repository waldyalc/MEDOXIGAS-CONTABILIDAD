"use client";

import { useState } from "react";

import { Bar, BarChart, CartesianGrid, type TooltipValueType, XAxis, YAxis } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  describirVariacionVentas,
  type PuntoSerieAnual,
  type ResumenAnual,
} from "@/lib/reportes/administrativos/e/anual";
import { formatearRd } from "@/lib/reportes/dinero";

interface Props {
  serieMensual: PuntoSerieAnual[];
  serieDiaria: PuntoSerieAnual[];
  resumen: ResumenAnual;
  anio: number;
  comparar: boolean;
}

type Vista = "mensual" | "diario";

const FORMATO_COMPACTO = new Intl.NumberFormat("es-DO", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatearEje(valorCentavos: number): string {
  return `RD$${FORMATO_COMPACTO.format(valorCentavos / 100)}`;
}

function formatearValor(valor: TooltipValueType | undefined): string {
  if (typeof valor === "number") return formatearRd(valor);
  if (typeof valor === "string") return formatearRd(Number(valor));
  return "";
}

export function GraficoVentasAnual({ serieMensual, serieDiaria, resumen, anio, comparar }: Props) {
  const [vista, setVista] = useState<Vista>("mensual");
  const datos = vista === "mensual" ? serieMensual : serieDiaria;
  const intervalo = vista === "mensual" ? 0 : 30;
  const config: ChartConfig = {
    actual: { label: String(anio), color: "var(--chart-1)" },
    anterior: { label: String(anio - 1), color: "var(--chart-2)" },
  };

  return (
    <div className="flex flex-col gap-3">
      <Tabs value={vista} onValueChange={(valor) => setVista(valor === "diario" ? "diario" : "mensual")}>
        <TabsList>
          <TabsTrigger value="mensual">Mensual</TabsTrigger>
          <TabsTrigger value="diario">Diario</TabsTrigger>
        </TabsList>
        <TabsContent value={vista} className="pt-3">
          <ChartContainer config={config} className="aspect-auto h-[320px] w-full">
            <BarChart data={datos} margin={{ left: 4, right: 4 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="etiqueta" tickLine={false} axisLine={false} tickMargin={8} interval={intervalo} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={formatearEje} width={72} />
              <ChartTooltip content={<ChartTooltipContent formatter={formatearValor} />} />
              {comparar ? <ChartLegend content={<ChartLegendContent />} /> : null}
              <Bar dataKey="actual" fill="var(--color-actual)" radius={4} />
              {comparar ? <Bar dataKey="anterior" fill="var(--color-anterior)" radius={4} /> : null}
            </BarChart>
          </ChartContainer>
        </TabsContent>
      </Tabs>

      {comparar ? <p className="text-muted-foreground text-sm">{describirVariacionVentas(resumen, anio)}</p> : null}
    </div>
  );
}
