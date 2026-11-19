"use client";

import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

import { useRouter } from "next/navigation";

import { cn } from "cn";

import { TableRow } from "@/components/ui/table";

/** Elementos dentro de la fila que ganan el click y no disparan la navegación. */
const SELECTOR_INTERACTIVO =
  'a, button, input, select, textarea, summary, [role="button"], [role="link"], [role="menuitem"], [role="menu"], [role="checkbox"], [role="radio"], [role="switch"], [role="option"], [role="tab"], [role="combobox"], [contenteditable="true"], [data-no-row-click]';

/**
 * ¿El click nació dentro de un elemento interactivo (link, botón, menú, input)?
 * Estructural, no `instanceof HTMLElement`: los iconos lucide son SVGElement
 * (un click en el ícono de un menú o link también debe ganar a la fila).
 */
export function dentroDeInteractivo(objetivo: unknown): boolean {
  if (typeof objetivo !== "object" || objetivo === null) return false;
  const closest = (objetivo as { closest?: unknown }).closest;
  return typeof closest === "function" && closest.call(objetivo, SELECTOR_INTERACTIVO) !== null;
}

/**
 * Fila de tabla que navega a `href` al hacer click en cualquier parte.
 * Recibe las celdas ya renderizadas para no romper el límite servidor→cliente:
 * `TablaLista` (servidor) le pasa `children`, nunca funciones.
 */
export function FilaNavegable({
  href,
  className,
  children,
}: {
  /** Destino de la ficha: la misma URL del enlace de la primera columna. Vacío = fila normal. */
  href?: string | null;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  if (!href) {
    return <TableRow className={className}>{children}</TableRow>;
  }

  const navegar = (pestanaNueva: boolean) => {
    if (pestanaNueva) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    router.push(href);
  };

  const alClick = (evento: MouseEvent<HTMLTableRowElement>) => {
    if (evento.button !== 0 || dentroDeInteractivo(evento.target)) return;
    if (window.getSelection()?.toString()) return;
    navegar(evento.metaKey || evento.ctrlKey);
  };

  const alClickAuxiliar = (evento: MouseEvent<HTMLTableRowElement>) => {
    if (evento.button !== 1 || dentroDeInteractivo(evento.target)) return;
    evento.preventDefault();
    navegar(true);
  };

  const alTeclar = (evento: KeyboardEvent<HTMLTableRowElement>) => {
    if (evento.key !== "Enter" || dentroDeInteractivo(evento.target)) return;
    navegar(evento.metaKey || evento.ctrlKey);
  };

  return (
    <TableRow
      role="link"
      tabIndex={0}
      data-href={href}
      className={cn(
        "cursor-pointer",
        "focus-visible:bg-slate-200/45 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-slate-400",
        "dark:focus-visible:bg-slate-800/40 dark:focus-visible:outline-slate-500",
        className,
      )}
      onClick={alClick}
      onAuxClick={alClickAuxiliar}
      onKeyDown={alTeclar}
    >
      {children}
    </TableRow>
  );
}
