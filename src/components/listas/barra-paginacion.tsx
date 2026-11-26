"use client";

import { type ReactNode, useEffect, useState } from "react";

import Link from "next/link";

import { cn } from "cn";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TAMANOS_PAGINA } from "@/lib/listas/parametros";

const formato = new Intl.NumberFormat("es-DO");

export function paginaDesdeTexto(valor: string, totalPaginas: number): number | null {
  const limpio = valor.trim();
  if (!/^\d+$/.test(limpio)) return null;

  const numero = Number(limpio);
  if (!Number.isSafeInteger(numero)) return null;

  return Math.min(Math.max(numero, 1), Math.max(1, totalPaginas));
}

function etiquetaConDosPuntos(etiqueta: string): string {
  const limpia = etiqueta.trim();
  return limpia.endsWith(":") ? limpia : `${limpia}:`;
}

function InputPagina({
  pagina,
  totalPaginas,
  onIrPagina,
}: {
  readonly pagina: number;
  readonly totalPaginas: number;
  readonly onIrPagina: (pagina: number) => void;
}) {
  const [valor, setValor] = useState(String(pagina));

  useEffect(() => {
    setValor(String(pagina));
  }, [pagina]);

  function confirmar() {
    const destino = paginaDesdeTexto(valor, totalPaginas);
    if (destino === null) {
      setValor(String(pagina));
      return;
    }

    setValor(String(destino));
    if (destino !== pagina) onIrPagina(destino);
  }

  return (
    <input
      value={valor}
      onChange={(evento) => setValor(evento.target.value)}
      onBlur={confirmar}
      onKeyDown={(evento) => {
        if (evento.key === "Enter") {
          evento.preventDefault();
          confirmar();
        }
      }}
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      aria-label="Ir a página"
      className="border-border bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/30 h-8 w-12 rounded-md border px-1 text-center text-sm tabular-nums outline-none focus-visible:ring-2"
    />
  );
}

function BotonPagina({
  destino,
  pagina,
  totalPaginas,
  hrefPagina,
  onIrPagina,
  ariaLabel,
  children,
}: {
  readonly destino: number;
  readonly pagina: number;
  readonly totalPaginas: number;
  readonly hrefPagina?: (pagina: number) => string;
  readonly onIrPagina: (pagina: number) => void;
  readonly ariaLabel: string;
  readonly children: ReactNode;
}) {
  const deshabilitado = destino < 1 || destino > totalPaginas || destino === pagina;
  const href = !deshabilitado && hrefPagina ? hrefPagina(destino) : null;

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={deshabilitado}
      aria-label={ariaLabel}
      className="text-muted-foreground hover:text-foreground"
      render={href ? <Link href={href} prefetch={false} /> : undefined}
      nativeButton={href === null}
      onClick={href ? undefined : () => onIrPagina(destino)}
    >
      {children}
    </Button>
  );
}

export function opcionesConActual(opciones: readonly number[], actual: number): readonly number[] {
  return [...new Set([...TAMANOS_PAGINA, ...opciones, actual])].sort((a, b) => a - b);
}

export function BarraPaginacionAlegra({
  pagina,
  totalPaginas,
  inicio,
  fin,
  total,
  tamano,
  opciones = TAMANOS_PAGINA,
  mostrarSelectorTamano = true,
  onCambiarTamano,
  onIrPagina,
  hrefPagina,
  etiquetaTamano = "Ítems por página:",
  sufijoRango,
  botonesExtremos = false,
  className,
}: {
  readonly pagina: number;
  readonly totalPaginas: number;
  readonly inicio: number;
  readonly fin: number;
  readonly total: number;
  readonly tamano: number;
  readonly opciones?: readonly number[];
  readonly mostrarSelectorTamano?: boolean;
  readonly onCambiarTamano?: (tamano: number) => void;
  readonly onIrPagina: (pagina: number) => void;
  readonly hrefPagina?: (pagina: number) => string;
  readonly etiquetaTamano?: string;
  readonly sufijoRango?: string;
  readonly botonesExtremos?: boolean;
  readonly className?: string;
}) {
  const etiqueta = etiquetaConDosPuntos(etiquetaTamano);
  const opcionesSelector = opcionesConActual(opciones, tamano);
  const conSelector = mostrarSelectorTamano && onCambiarTamano !== undefined;

  return (
    <div
      className={cn(
        "border-border text-muted-foreground flex flex-wrap items-center justify-between gap-3 border-t px-4 py-2.5 text-sm",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {conSelector ? (
          <>
            <span className="text-foreground">{etiqueta}</span>
            <Select
              value={String(tamano)}
              onValueChange={(valor) => {
                if (valor !== null && valor !== String(tamano)) onCambiarTamano(Number(valor));
              }}
            >
              <SelectTrigger className="h-8 w-[68px] rounded-md" aria-label={etiqueta}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {opcionesSelector.map((opcion) => (
                  <SelectItem key={opcion} value={String(opcion)}>
                    {opcion}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="bg-border h-4 w-px" aria-hidden="true" />
          </>
        ) : null}
        <p className="text-muted-foreground tabular-nums">
          {formato.format(inicio)}-{formato.format(fin)} de {formato.format(total)}
          {sufijoRango ? ` ${sufijoRango}` : ""}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {botonesExtremos ? (
          <BotonPagina
            destino={1}
            pagina={pagina}
            totalPaginas={totalPaginas}
            hrefPagina={hrefPagina}
            onIrPagina={onIrPagina}
            ariaLabel="Primera página"
          >
            <ChevronsLeft />
          </BotonPagina>
        ) : null}
        <span className="text-foreground">Página</span>
        <InputPagina pagina={pagina} totalPaginas={totalPaginas} onIrPagina={onIrPagina} />
        <span className="tabular-nums">de {formato.format(totalPaginas)}</span>
        <BotonPagina
          destino={pagina - 1}
          pagina={pagina}
          totalPaginas={totalPaginas}
          hrefPagina={hrefPagina}
          onIrPagina={onIrPagina}
          ariaLabel="Página anterior"
        >
          <ChevronLeft />
        </BotonPagina>
        <BotonPagina
          destino={pagina + 1}
          pagina={pagina}
          totalPaginas={totalPaginas}
          hrefPagina={hrefPagina}
          onIrPagina={onIrPagina}
          ariaLabel="Página siguiente"
        >
          <ChevronRight />
        </BotonPagina>
        {botonesExtremos ? (
          <BotonPagina
            destino={totalPaginas}
            pagina={pagina}
            totalPaginas={totalPaginas}
            hrefPagina={hrefPagina}
            onIrPagina={onIrPagina}
            ariaLabel="Última página"
          >
            <ChevronsRight />
          </BotonPagina>
        ) : null}
      </div>
    </div>
  );
}
