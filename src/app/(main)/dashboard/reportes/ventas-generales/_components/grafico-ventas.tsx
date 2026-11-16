"use client";

import Link from "next/link";

import { TrendingUp } from "lucide-react";

import { GraficoAreaSerie } from "@/components/reportes/grafico-area-serie";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import type { Periodicidad, PuntoSerieVentas } from "@/lib/reportes/ventas/v1/tipos";

interface Props {
  serie: PuntoSerieVentas[];
  grafico: Periodicidad;
  hrefDiario: string;
  hrefMensual: string;
}

export function GraficoVentas({ serie, grafico, hrefDiario, hrefMensual }: Props) {
  return (
    <Card className="py-0">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 py-4">
        <CardTitle>Ventas</CardTitle>
        <div className="flex items-center gap-1 print:hidden">
          <Button
            size="sm"
            variant={grafico === "diario" ? "secondary" : "ghost"}
            nativeButton={false}
            aria-current={grafico === "diario" ? "page" : undefined}
            render={<Link href={hrefDiario} />}
          >
            Diario
          </Button>
          <Button
            size="sm"
            variant={grafico === "mensual" ? "secondary" : "ghost"}
            nativeButton={false}
            aria-current={grafico === "mensual" ? "page" : undefined}
            render={<Link href={hrefMensual} />}
          >
            Mensual
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-4">
        {serie.length === 0 ? (
          <Empty className="border-0 py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <TrendingUp />
              </EmptyMedia>
              <EmptyTitle>Sin ventas en el período</EmptyTitle>
              <EmptyDescription>Prueba con otro rango de fechas o quita los filtros.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <GraficoAreaSerie serie={serie} etiqueta="Después de impuestos" />
        )}
      </CardContent>
    </Card>
  );
}
