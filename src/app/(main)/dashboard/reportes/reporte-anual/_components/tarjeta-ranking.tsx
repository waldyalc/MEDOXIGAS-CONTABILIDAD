"use client";

import { useState } from "react";

import Link from "next/link";

import { Bar, BarChart, CartesianGrid, type TooltipValueType, XAxis, YAxis } from "recharts";

import { FilaNavegable } from "@/components/listas/fila-navegable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatearPorcentajeAnual } from "@/lib/reportes/administrativos/e/anual";
import { formatearRd } from "@/lib/reportes/dinero";

export interface FilaRanking {
  id: string | null;
  nombre: string;
  monto: number;
  participacion: number;
  href: string | null;
}

interface Props {
  titulo: string;
  descripcion: string;
  columnaNombre: string;
  etiquetaValor?: string;
  filas: FilaRanking[];
}

const LIMITE_VISIBLES = 5;

function formatearValor(valor: TooltipValueType | undefined): string {
  if (typeof valor === "number") return formatearRd(valor);
  if (typeof valor === "string") return formatearRd(Number(valor));
  return "";
}

function recortarNombre(valor: unknown): string {
  if (typeof valor !== "string") return "";
  return valor.length > 18 ? `${valor.slice(0, 17)}…` : valor;
}

export function TarjetaRanking({ titulo, descripcion, columnaNombre, etiquetaValor = "Valor", filas }: Props) {
  const [mostrarTodas, setMostrarTodas] = useState(false);
  const visibles = mostrarTodas ? filas : filas.slice(0, LIMITE_VISIBLES);
  const config: ChartConfig = {
    monto: { label: etiquetaValor, color: "var(--chart-1)" },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        <CardDescription>{descripcion}</CardDescription>
      </CardHeader>
      <CardContent>
        {filas.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>Sin datos</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <Tabs defaultValue="grafico">
              <TabsList>
                <TabsTrigger value="grafico">Gráfico</TabsTrigger>
                <TabsTrigger value="tabla">Tabla</TabsTrigger>
              </TabsList>
              <TabsContent value="grafico" className="pt-3">
                <ChartContainer
                  config={config}
                  className="aspect-auto w-full"
                  style={{ height: `${Math.max(220, visibles.length * 44)}px` }}
                >
                  <BarChart data={visibles} layout="vertical" margin={{ left: 4, right: 16 }}>
                    <CartesianGrid horizontal={false} />
                    <XAxis type="number" dataKey="monto" hide />
                    <YAxis
                      type="category"
                      dataKey="nombre"
                      width={110}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={recortarNombre}
                    />
                    <ChartTooltip content={<ChartTooltipContent formatter={formatearValor} />} />
                    <Bar dataKey="monto" fill="var(--color-monto)" radius={4} />
                  </BarChart>
                </ChartContainer>
              </TabsContent>
              <TabsContent value="tabla" className="pt-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{columnaNombre}</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Participación</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibles.map((fila) => (
                      <FilaNavegable key={fila.id ?? `nombre:${fila.nombre}`} href={fila.href}>
                        <TableCell>
                          {fila.href ? (
                            <Link href={fila.href} className="hover:underline">
                              {fila.nombre}
                            </Link>
                          ) : (
                            fila.nombre
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatearRd(fila.monto)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatearPorcentajeAnual(fila.participacion)}
                        </TableCell>
                      </FilaNavegable>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>

            {filas.length > LIMITE_VISIBLES ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-3"
                onClick={() => setMostrarTodas((valor) => !valor)}
              >
                {mostrarTodas ? "Ver menos" : "Ver más"}
              </Button>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
