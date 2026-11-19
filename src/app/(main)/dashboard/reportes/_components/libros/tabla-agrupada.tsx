"use client";

import { ChevronRight } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { FilaNavegable } from "@/components/listas/fila-navegable";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rutaAsiento, rutaContacto, rutaCuenta } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";
import { formatearRd } from "@/lib/reportes/dinero";
import type { GrupoAgrupado, TotalesAgrupado } from "@/lib/reportes/libros/agrupado";

import { EstadoAsiento } from "./estado-asiento";

interface Props {
  grupos: readonly GrupoAgrupado[];
  total: TotalesAgrupado;
}

function Cifras({ grupo }: { grupo: GrupoAgrupado }) {
  return (
    <>
      <span className="hidden text-right tabular-nums sm:block">{formatearRd(grupo.saldoInicial)}</span>
      <span className="hidden text-right tabular-nums sm:block">{formatearRd(grupo.debito)}</span>
      <span className="hidden text-right tabular-nums sm:block">{formatearRd(grupo.credito)}</span>
      <span className="hidden text-right tabular-nums sm:block">{formatearRd(grupo.neto)}</span>
      <span className="text-right font-medium tabular-nums">{formatearRd(grupo.saldoFinal)}</span>
    </>
  );
}

export function TablaAgrupada({ grupos, total }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-muted-foreground hidden grid-cols-6 gap-3 px-4 text-xs font-medium md:grid">
        <span>Cuenta contable / Tercero</span>
        <span className="text-right">Saldo inicial</span>
        <span className="text-right">Débito</span>
        <span className="text-right">Crédito</span>
        <span className="text-right">Movimiento neto</span>
        <span className="text-right">Saldo final</span>
      </div>

      {grupos.map((grupo) => (
        <Card key={grupo.clave} className="overflow-hidden py-0">
          <Collapsible>
            <CollapsibleTrigger className="hover:bg-muted/40 grid w-full grid-cols-2 items-center gap-3 px-4 py-3 text-left transition-colors sm:grid-cols-6">
              <span className="flex items-center gap-2 font-medium">
                <ChevronRight className="size-4 shrink-0 transition-transform data-[panel-open]:rotate-90" />
                {grupo.etiqueta}
              </span>
              <Cifras grupo={grupo} />
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="border-t p-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asiento</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Tercero</TableHead>
                      <TableHead>Código contable</TableHead>
                      <TableHead>Cuenta contable</TableHead>
                      <TableHead>Tipo de documento</TableHead>
                      <TableHead className="text-right">Débito</TableHead>
                      <TableHead className="text-right">Crédito</TableHead>
                      <TableHead className="text-right">Movimiento neto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grupo.detalles.map((detalle) => (
                      <FilaNavegable key={detalle.clave} href={rutaAsiento(detalle.asientoId)}>
                        <TableCell className="tabular-nums">
                          <Enlace href={rutaAsiento(detalle.asientoId)}>#{detalle.asientoNumero}</Enlace>
                        </TableCell>
                        <TableCell>{formatoDia(detalle.fecha)}</TableCell>
                        <TableCell>
                          <EstadoAsiento estado={detalle.estado} />
                        </TableCell>
                        <TableCell>
                          {detalle.contactoId ? (
                            <Enlace href={rutaContacto(detalle.contactoId)}>{detalle.tercero}</Enlace>
                          ) : (
                            detalle.tercero
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground tabular-nums">
                          <Enlace href={rutaCuenta(detalle.cuentaId)}>{detalle.cuentaCodigo}</Enlace>
                        </TableCell>
                        <TableCell>
                          <Enlace href={rutaCuenta(detalle.cuentaId)}>{detalle.cuentaNombre}</Enlace>
                        </TableCell>
                        <TableCell>{detalle.tipoDocumento}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {detalle.debito === 0 ? "" : formatearRd(detalle.debito)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {detalle.credito === 0 ? "" : formatearRd(detalle.credito)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatearRd(detalle.neto)}</TableCell>
                      </FilaNavegable>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      ))}

      <Card className="py-0">
        <div className="grid grid-cols-2 items-center gap-3 px-4 py-3 font-semibold sm:grid-cols-6">
          <span>Total general</span>
          <span className="hidden text-right tabular-nums sm:block">{formatearRd(total.saldoInicial)}</span>
          <span className="hidden text-right tabular-nums sm:block">{formatearRd(total.debito)}</span>
          <span className="hidden text-right tabular-nums sm:block">{formatearRd(total.credito)}</span>
          <span className="hidden text-right tabular-nums sm:block">{formatearRd(total.neto)}</span>
          <span className="text-right tabular-nums">{formatearRd(total.saldoFinal)}</span>
        </div>
      </Card>
    </div>
  );
}
