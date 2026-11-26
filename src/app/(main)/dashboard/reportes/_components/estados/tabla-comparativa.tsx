"use client";

import { type ReactNode, useState } from "react";

import { cn } from "cn";

import { Enlace } from "@/components/enlace";
import { ChevronDown } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader } from "@/components/ui/table";
import { rutaCuenta } from "@/lib/enlaces";
import { formatearRd } from "@/lib/reportes/dinero";
import type { FilaReporte } from "@/lib/reportes/estados/tipos";

import {
  type ConfiguracionEncabezadoTablaComparativa,
  EncabezadoTablaComparativa,
} from "./encabezado-tabla-comparativa";

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
  /** Barra superior interna de la tarjeta (buscador, árbol y rango), como en Alegra. */
  encabezado?: ConfiguracionEncabezadoTablaComparativa;
}

/** % de Ingresos: siempre 2 decimales, como en Alegra ("112.82%"). */
function formatoPorcentaje(valor: number): string {
  return `${valor.toFixed(2)}%`;
}

/** Var. Relativa: hasta 2 decimales, sin forzar decimales en enteros ("-41.64%", "-100%", "0%"). */
export function formatoVariacion(valor: number): string {
  const redondeado = Math.round(valor * 100) / 100;
  const limpio = Object.is(redondeado, -0) ? 0 : redondeado;
  return `${limpio
    .toFixed(2)
    .replace(/\.00$/, "")
    .replace(/(\.\d)0$/, "$1")}%`;
}

/** Estado siguiente del botón de árbol: si queda una cuenta abierta, contrae todo; si no, expande todo. */
export function alternarTodasLasCuentas(
  contraidos: ReadonlySet<string>,
  claves: readonly string[],
): ReadonlySet<string> {
  const hayAbiertas = claves.some((clave) => !contraidos.has(clave));
  return new Set(hayAbiertas ? claves : []);
}

function claseVariacion(valor: number): string | null {
  if (valor > 0) return "text-emerald-600 dark:text-emerald-400";
  if (valor < 0) return "text-rose-600 dark:text-rose-400";
  return null;
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

interface EntradaPila {
  clave: string;
  nivel: number;
  cadena: readonly string[];
}

function podarPila(pila: EntradaPila[], nivel: number) {
  while (pila.length > 0) {
    const tope = pila.at(-1);
    if (tope == null || tope.nivel < nivel) break;
    pila.pop();
  }
}

/**
 * El árbol del reporte se lee en una pasada: cada grupo contiene a las filas
 * que le siguen con un nivel mayor, hasta el próximo total/sección.
 */
function agrupar(filas: readonly FilaReporte[]): Agrupacion {
  const hijas = new Map<string, number>();
  const ancestros = new Map<string, readonly string[]>();
  const pila: EntradaPila[] = [];

  for (const fila of filas) {
    if (fila.clase === "total" || fila.clase === "titulo") {
      pila.length = 0;
      continue;
    }

    const nivel = nivelDe(fila);
    podarPila(pila, nivel);

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
  return fila.cuentaId ? (
    <Enlace href={rutaCuenta(fila.cuentaId)} className="block max-w-[225px] break-words text-inherit">
      {fila.nombre}
    </Enlace>
  ) : (
    fila.nombre
  );
}

const CELDA_NUMERICA = "h-12 px-4 py-0 text-right text-xs whitespace-nowrap tabular-nums";

function Montos({ fila }: { fila: FilaReporte }) {
  const total = fila.clase === "total";
  /* Alegra pinta en rojo los importes de las hojas «contra» (devoluciones);
     las hojas de gasto/costo van en negro aunque se muestran con signo -. */
  const periodo = fila.contra ? "text-rose-600 dark:text-rose-400" : null;
  const variacionAbsoluta = claseVariacion(fila.variacionAbsoluta);
  const variacionRelativa = claseVariacion(fila.variacionRelativa);
  return (
    <>
      <TableCell className={cn(CELDA_NUMERICA, periodo, total && "font-semibold")}>
        {formatearRd(fila.actual)}
      </TableCell>
      <TableCell className={cn(CELDA_NUMERICA, total && "font-semibold")}>
        {formatoPorcentaje(fila.porcentajeActual)}
      </TableCell>
      <TableCell className={cn(CELDA_NUMERICA, periodo, total && "font-semibold")}>
        {formatearRd(fila.anterior)}
      </TableCell>
      <TableCell className={cn(CELDA_NUMERICA, total && "font-semibold")}>
        {formatoPorcentaje(fila.porcentajeAnterior)}
      </TableCell>
      <TableCell className={cn(CELDA_NUMERICA, variacionAbsoluta, total && "font-semibold")}>
        {formatearRd(fila.variacionAbsoluta)}
      </TableCell>
      <TableCell className={cn(CELDA_NUMERICA, variacionRelativa, total && "font-semibold")}>
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

const FILA_BASE = "border-b border-border/60 bg-card hover:bg-transparent dark:hover:bg-transparent";

function ControlExpansion({ fila, conChevron, abierto, onAlternar }: Omit<FilaProps, "oculta">) {
  if (fila.clase === "total") return null;
  if (!conChevron) return <span aria-hidden="true" className="inline-block size-8 shrink-0" />;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="size-8 shrink-0 bg-transparent text-slate-600 hover:bg-transparent hover:text-slate-900 aria-expanded:bg-transparent dark:text-slate-300 dark:hover:bg-transparent dark:hover:text-slate-100 print:hidden"
      aria-expanded={abierto}
      aria-label={`${abierto ? "Contraer" : "Expandir"} ${fila.nombre}`}
      onClick={() => onAlternar(fila.clave)}
    >
      <ChevronDown className={cn("size-4 transition-transform", abierto ? null : "-rotate-90")} />
    </Button>
  );
}

function claseNombre(fila: FilaReporte, nivel: number): string {
  if (fila.clase === "total") return "text-sm font-semibold";
  const peso = fila.clase === "grupo" && nivel === 0 ? "font-semibold" : "font-normal";
  return cn("text-[13px]", peso);
}

function FilaComparativa({ fila, conChevron, abierto, oculta, onAlternar }: FilaProps) {
  const nivel = nivelDe(fila);
  const total = fila.clase === "total";

  return (
    <tr
      className={cn(
        FILA_BASE,
        total && "bg-muted/35 hover:bg-muted/35 dark:bg-muted/25 dark:hover:bg-muted/25",
        oculta && "hidden print:table-row",
      )}
    >
      <TableCell className="h-12 px-4 py-0">
        <div className="flex h-full items-center gap-2" style={{ paddingLeft: `${nivel * 2}rem` }}>
          <ControlExpansion fila={fila} conChevron={conChevron} abierto={abierto} onAlternar={onAlternar} />
          <span className={cn("block max-w-[225px] break-words", claseNombre(fila, nivel))}>
            <CeldaCuenta fila={fila} />
          </span>
        </div>
      </TableCell>
      <Montos fila={fila} />
    </tr>
  );
}

function DivisorVertical() {
  return <span aria-hidden="true" className="bg-border/70 absolute top-2 right-0 bottom-2 w-px" />;
}

function EncabezadoColumna({
  children,
  clase,
  divisor = true,
}: {
  children: ReactNode;
  clase?: string;
  divisor?: boolean;
}) {
  return (
    <TableHead
      className={cn("text-muted-foreground relative h-10 px-4 text-right text-xs font-medium whitespace-nowrap", clase)}
    >
      {children}
      {divisor ? <DivisorVertical /> : null}
    </TableHead>
  );
}

export function TablaComparativa({
  filas,
  rotuloCuenta,
  rotuloActual,
  rotuloAnterior,
  rotuloPorcentaje,
  expandible = false,
  encabezado,
}: Props) {
  const [contraidos, setContraidos] = useState<ReadonlySet<string>>(() => new Set());
  const { hijas, ancestros } = agrupar(filas);
  const clavesConHijas = expandible
    ? filas.filter((fila) => fila.clase === "grupo" && (hijas.get(fila.clave) ?? 0) > 0).map((fila) => fila.clave)
    : [];
  const todasContraidas = clavesConHijas.length > 0 && clavesConHijas.every((clave) => contraidos.has(clave));

  function alternar(clave: string) {
    setContraidos((previos) => {
      const siguientes = new Set(previos);
      if (siguientes.has(clave)) siguientes.delete(clave);
      else siguientes.add(clave);
      return siguientes;
    });
  }

  function alternarTodas() {
    setContraidos((previos) => alternarTodasLasCuentas(previos, clavesConHijas));
  }

  return (
    <>
      {encabezado ? (
        <EncabezadoTablaComparativa
          {...encabezado}
          todasContraidas={todasContraidas}
          onAlternarTodas={clavesConHijas.length > 0 ? alternarTodas : undefined}
        />
      ) : null}
      <Table className="min-w-[1235px]">
        <TableHeader className="bg-card">
          <tr className="border-border bg-card border-b">
            <EncabezadoColumna clase="w-[350px] min-w-[350px] text-left">{rotuloCuenta || "\u00A0"}</EncabezadoColumna>
            <EncabezadoColumna clase="min-w-[150px]">{rotuloActual}</EncabezadoColumna>
            <EncabezadoColumna clase="min-w-[140px]">{rotuloPorcentaje}</EncabezadoColumna>
            <EncabezadoColumna clase="min-w-[150px]">{rotuloAnterior}</EncabezadoColumna>
            <EncabezadoColumna clase="min-w-[140px]">{rotuloPorcentaje}</EncabezadoColumna>
            <EncabezadoColumna clase="min-w-[150px]">Var. Absoluta</EncabezadoColumna>
            <EncabezadoColumna clase="min-w-[155px]" divisor={false}>
              Var. Relativa (%)
            </EncabezadoColumna>
          </tr>
        </TableHeader>
        <TableBody>
          {filas.map((fila) => {
            if (fila.clase === "titulo") {
              return (
                <tr key={fila.clave} className={FILA_BASE}>
                  <TableCell colSpan={7} className="h-12 px-4 py-0 text-[13px] font-semibold">
                    {fila.nombre}
                  </TableCell>
                </tr>
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
    </>
  );
}
