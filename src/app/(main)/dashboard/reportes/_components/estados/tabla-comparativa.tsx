"use client";

import { useState } from "react";

import { cn } from "cn";

import { Enlace } from "@/components/enlace";
import { ChevronDown } from "@/components/icons";
import { FilaNavegable } from "@/components/listas/fila-navegable";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rutaCuenta } from "@/lib/enlaces";
import { formatoPct } from "@/lib/formato";
import { formatearRd } from "@/lib/reportes/dinero";
import type { FilaReporte } from "@/lib/reportes/estados/tipos";

interface Props {
  filas: readonly FilaReporte[];
  rotuloCuenta: string;
  rotuloActual: string;
  rotuloAnterior: string;
  rotuloPorcentaje: string;
  /**
   * Grupos con chevron para expandir/contraer sus cuentas hijas (patrón del
   * estado de resultados). Sin esta prop la tabla se ve como siempre.
   */
  expandible?: boolean;
}

/**
 * Montos con texto plano y el signo en el prefijo: Alegra no colorea los
 * montos de sus reportes (decisión de Waldy, 20-11-2026: el rojo/verde por
 * signo se ve chillón y no es parte del diseño de Alegra).
 */

interface Agrupacion {
  /** Cuántas cuentas de detalle cuelgan de cada grupo. */
  hijas: ReadonlyMap<string, number>;
  /** Grupo al que pertenece cada cuenta de detalle. */
  grupoDe: ReadonlyMap<string, string>;
}

/**
 * Los detalles del reporte son filas seguidas a su grupo. Se agrupan en una
 * pasada para saber cuáles contraer y cuáles grupos llevan chevron.
 */
function agrupar(filas: readonly FilaReporte[]): Agrupacion {
  const hijas = new Map<string, number>();
  const grupoDe = new Map<string, string>();
  let grupoActual: string | null = null;

  for (const fila of filas) {
    if (fila.clase === "grupo") {
      grupoActual = fila.clave;
      hijas.set(grupoActual, 0);
      continue;
    }

    if (fila.clase === "detalle" && grupoActual != null) {
      hijas.set(grupoActual, (hijas.get(grupoActual) ?? 0) + 1);
      grupoDe.set(fila.clave, grupoActual);
      continue;
    }

    grupoActual = null;
  }

  return { hijas, grupoDe };
}

function CeldaCuenta({ fila }: { fila: FilaReporte }) {
  const contenido = (
    <>
      {fila.codigo === "" ? null : <span className="text-muted-foreground">{fila.codigo}</span>}
      {fila.codigo === "" ? null : " "}
      {fila.nombre}
    </>
  );

  return fila.cuentaId ? <Enlace href={rutaCuenta(fila.cuentaId)}>{contenido}</Enlace> : contenido;
}

function Montos({ fila }: { fila: FilaReporte }) {
  return (
    <>
      <TableCell className="text-right tabular-nums">{formatearRd(fila.actual)}</TableCell>
      <TableCell className="text-muted-foreground text-right tabular-nums">
        {formatoPct(fila.porcentajeActual)}
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatearRd(fila.anterior)}</TableCell>
      <TableCell className="text-muted-foreground text-right tabular-nums">
        {formatoPct(fila.porcentajeAnterior)}
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatearRd(fila.variacionAbsoluta)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatoPct(fila.variacionRelativa)}</TableCell>
    </>
  );
}

interface FilaProps {
  fila: FilaReporte;
  conChevron: boolean;
  abierto: boolean;
  oculta: boolean;
  onAlternar: (clave: string) => void;
}

function FilaComparativa({ fila, conChevron, abierto, oculta, onAlternar }: FilaProps) {
  return (
    <FilaNavegable
      href={fila.cuentaId ? rutaCuenta(fila.cuentaId) : null}
      className={cn(
        (fila.clase === "grupo" || fila.clase === "total") && "font-semibold",
        oculta && "hidden print:table-row",
      )}
    >
      <TableCell className={cn("pl-4", fila.clase === "detalle" && "pl-14")}>
        <div className="flex items-center gap-1">
          {conChevron ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground -ml-2 shrink-0 print:hidden"
              aria-expanded={abierto}
              aria-label={`${abierto ? "Contraer" : "Expandir"} ${fila.nombre}`}
              onClick={() => onAlternar(fila.clave)}
            >
              <ChevronDown className={cn("transition-transform", abierto ? null : "-rotate-90")} />
            </Button>
          ) : null}
          <CeldaCuenta fila={fila} />
        </div>
      </TableCell>
      <Montos fila={fila} />
    </FilaNavegable>
  );
}

export function TablaComparativa({
  filas,
  rotuloCuenta,
  rotuloActual,
  rotuloAnterior,
  rotuloPorcentaje,
  expandible = false,
}: Props) {
  const [contraidos, setContraidos] = useState<ReadonlySet<string>>(() => new Set());
  const { hijas, grupoDe } = agrupar(filas);

  function alternar(clave: string) {
    setContraidos((previos) => {
      const siguientes = new Set(previos);
      if (siguientes.has(clave)) siguientes.delete(clave);
      else siguientes.add(clave);
      return siguientes;
    });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-muted-foreground pl-4">{rotuloCuenta}</TableHead>
          <TableHead className="text-muted-foreground text-right">{rotuloActual}</TableHead>
          <TableHead className="text-muted-foreground text-right">{rotuloPorcentaje}</TableHead>
          <TableHead className="text-muted-foreground text-right">{rotuloAnterior}</TableHead>
          <TableHead className="text-muted-foreground text-right">{rotuloPorcentaje}</TableHead>
          <TableHead className="text-muted-foreground text-right">Var. Absoluta</TableHead>
          <TableHead className="text-muted-foreground text-right">Var. Relativa (%)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filas.map((fila) => {
          if (fila.clase === "titulo") {
            return (
              <TableRow key={fila.clave} className="bg-muted/50 hover:bg-muted/50">
                <TableCell colSpan={7} className="px-4 font-semibold">
                  {fila.nombre}
                </TableCell>
              </TableRow>
            );
          }

          const conChevron = expandible && fila.clase === "grupo" && (hijas.get(fila.clave) ?? 0) > 0;
          const grupo = grupoDe.get(fila.clave);

          return (
            <FilaComparativa
              key={fila.clave}
              fila={fila}
              conChevron={conChevron}
              abierto={conChevron && !contraidos.has(fila.clave)}
              oculta={grupo != null && contraidos.has(grupo)}
              onAlternar={alternar}
            />
          );
        })}
      </TableBody>
    </Table>
  );
}
