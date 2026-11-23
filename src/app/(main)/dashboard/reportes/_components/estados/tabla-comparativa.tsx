"use client";

import { useState } from "react";

import { cn } from "cn";

import { Enlace } from "@/components/enlace";
import { ChevronDown } from "@/components/icons";
import { FilaNavegable } from "@/components/listas/fila-navegable";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rutaCuenta } from "@/lib/enlaces";
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

/** % de Ingresos: siempre 2 decimales, como en Alegra ("112.82%"). */
function formatoPorcentaje(valor: number): string {
  return `${valor.toFixed(2)}%`;
}

/** Var. Relativa: entero con signo implícito ("0%", "-15%"), como en Alegra. */
function formatoVariacion(valor: number): string {
  return `${Math.round(valor)}%`;
}

function nivelDe(fila: FilaReporte): number {
  return fila.nivel ?? (fila.clase === "detalle" ? 1 : 0);
}

interface Agrupacion {
  /** Cuántas filas cuelgan directamente de cada grupo (cualquier clase). */
  hijas: ReadonlyMap<string, number>;
  /** Cadena de grupos que contiene a cada fila (sección > subgrupo > hoja). */
  ancestros: ReadonlyMap<string, readonly string[]>;
}

/**
 * El árbol del reporte se lee en una pasada: cada grupo contiene a las filas
 * que le siguen con un nivel mayor, hasta el próximo total/sección.
 */
function agrupar(filas: readonly FilaReporte[]): Agrupacion {
  const hijas = new Map<string, number>();
  const ancestros = new Map<string, readonly string[]>();
  const pila: { clave: string; nivel: number; cadena: readonly string[] }[] = [];

  for (const fila of filas) {
    if (fila.clase === "total" || fila.clase === "titulo") {
      pila.length = 0;
      continue;
    }

    const nivel = nivelDe(fila);
    while (pila.length > 0 && (pila.at(-1)?.nivel ?? 0) >= nivel) pila.pop();

    const tope = pila.at(-1);
    if (tope != null) {
      ancestros.set(fila.clave, tope.cadena);
      hijas.set(tope.clave, (hijas.get(tope.clave) ?? 0) + 1);
    }

    if (fila.clase === "grupo") {
      const cadena = [...(tope?.cadena ?? []), fila.clave];
      pila.push({ clave: fila.clave, nivel, cadena });
      if (!hijas.has(fila.clave)) hijas.set(fila.clave, 0);
    }
  }

  return { hijas, ancestros };
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
  const total = fila.clase === "total";
  return (
    <>
      <TableCell className={cn("text-right text-xs whitespace-nowrap tabular-nums", total && "font-semibold")}>
        {formatearRd(fila.actual)}
      </TableCell>
      <TableCell
        className={cn(
          "text-right text-xs whitespace-nowrap tabular-nums",
          total ? "font-semibold" : "text-muted-foreground",
        )}
      >
        {formatoPorcentaje(fila.porcentajeActual)}
      </TableCell>
      <TableCell className={cn("text-right text-xs whitespace-nowrap tabular-nums", total && "font-semibold")}>
        {formatearRd(fila.anterior)}
      </TableCell>
      <TableCell
        className={cn(
          "text-right text-xs whitespace-nowrap tabular-nums",
          total ? "font-semibold" : "text-muted-foreground",
        )}
      >
        {formatoPorcentaje(fila.porcentajeAnterior)}
      </TableCell>
      <TableCell
        className={cn(
          "text-right text-xs whitespace-nowrap tabular-nums",
          fila.variacionAbsoluta > 0 && "text-green-700",
          fila.variacionAbsoluta < 0 && "text-rose-700",
          total && "font-semibold",
        )}
      >
        {formatearRd(fila.variacionAbsoluta)}
      </TableCell>
      <TableCell className={cn("text-right text-xs whitespace-nowrap tabular-nums", total && "font-semibold")}>
        {formatoVariacion(fila.variacionRelativa)}
      </TableCell>
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
  const nivel = nivelDe(fila);
  const total = fila.clase === "total";

  return (
    <FilaNavegable
      href={fila.cuentaId ? rutaCuenta(fila.cuentaId) : null}
      className={cn(total && "bg-slate-50 hover:bg-slate-50", oculta && "hidden print:table-row")}
    >
      <TableCell className="pl-4">
        <div className="flex items-center gap-1" style={{ paddingLeft: `${nivel * 2}rem` }}>
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
          ) : (
            <span aria-hidden="true" className="-ml-2 inline-block w-6 shrink-0" />
          )}
          <span
            className={cn(
              "text-xs",
              (fila.clase === "grupo" && nivel === 0) || total ? "font-semibold" : null,
              total && "text-sm",
            )}
          >
            <CeldaCuenta fila={fila} />
          </span>
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
  const { hijas, ancestros } = agrupar(filas);

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
          <TableHead className="text-muted-foreground min-w-[280px] pl-4">{rotuloCuenta}</TableHead>
          <TableHead className="text-muted-foreground text-right whitespace-nowrap">{rotuloActual}</TableHead>
          <TableHead className="text-muted-foreground text-right whitespace-nowrap">{rotuloPorcentaje}</TableHead>
          <TableHead className="text-muted-foreground text-right whitespace-nowrap">{rotuloAnterior}</TableHead>
          <TableHead className="text-muted-foreground text-right whitespace-nowrap">{rotuloPorcentaje}</TableHead>
          <TableHead className="text-muted-foreground text-right whitespace-nowrap">Var. Absoluta</TableHead>
          <TableHead className="text-muted-foreground text-right whitespace-nowrap">Var. Relativa (%)</TableHead>
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
          const oculta = (ancestros.get(fila.clave) ?? []).some((clave) => contraidos.has(clave));

          return (
            <FilaComparativa
              key={fila.clave}
              fila={fila}
              conChevron={conChevron}
              abierto={conChevron && !contraidos.has(fila.clave)}
              oculta={oculta}
              onAlternar={alternar}
            />
          );
        })}
      </TableBody>
    </Table>
  );
}
