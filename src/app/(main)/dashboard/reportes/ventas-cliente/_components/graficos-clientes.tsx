"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatearRd } from "@/lib/reportes/dinero";
import type { ClienteVentas } from "@/lib/reportes/ventas/v3/tipos";
import { mejoresPorIngresos, mejoresPorVentas } from "@/lib/reportes/ventas/v3/ventas-cliente";

const CONFIG_INGRESOS: ChartConfig = {
  ingresos: { label: "Ingresos", color: "var(--chart-2)" },
};

const CONFIG_VENTAS: ChartConfig = {
  ventas: { label: "Ventas", color: "var(--chart-3)" },
};

export function GraficosClientes({ clientes }: { clientes: readonly ClienteVentas[] }) {
  if (clientes.length === 0) return null;

  const porIngresos = mejoresPorIngresos(clientes).map((cliente) => ({
    nombre: cliente.contactoNombre,
    ingresos: cliente.despuesImpuestos / 100,
  }));

  const porVentas = mejoresPorVentas(clientes).map((cliente) => ({
    nombre: cliente.contactoNombre,
    ventas: cliente.numeroVentas,
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2 print:hidden">
      <Card>
        <CardHeader>
          <CardTitle>Mejores clientes por ingresos</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={CONFIG_INGRESOS} className="aspect-auto h-64 w-full">
            <BarChart data={porIngresos} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="nombre" width={130} tickLine={false} axisLine={false} />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent formatter={(valor) => formatearRd(Math.round(Number(valor) * 100))} />}
              />
              <Bar dataKey="ingresos" fill="var(--color-ingresos)" radius={4} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mejores clientes por número de ventas</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={CONFIG_VENTAS} className="aspect-auto h-64 w-full">
            <BarChart data={porVentas} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" allowDecimals={false} hide />
              <YAxis type="category" dataKey="nombre" width={130} tickLine={false} axisLine={false} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <Bar dataKey="ventas" fill="var(--color-ventas)" radius={4} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
