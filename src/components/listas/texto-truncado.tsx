"use client";

import type { ReactNode } from "react";
import { isValidElement } from "react";

import { cn } from "cn";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const UMBRAL_TOOLTIP_DOS_LINEAS = 26;
const UMBRAL_TOOLTIP_UNA_LINEA = 18;

function textoCrudo(nodo: ReactNode): string {
  if (nodo == null || typeof nodo === "boolean") return "";
  if (typeof nodo === "string") return nodo;
  if (typeof nodo === "number" || typeof nodo === "bigint") return String(nodo);
  if (Array.isArray(nodo)) return nodo.map(textoCrudo).join("");
  if (isValidElement<{ children?: ReactNode }>(nodo)) return textoCrudo(nodo.props.children);
  return "";
}

export function extraerTextoPlano(nodo: ReactNode): string {
  return textoCrudo(nodo).replace(/\s+/g, " ").trim();
}

export function TextoTruncado({
  children,
  texto,
  lineas = 2,
  className,
}: {
  children: ReactNode;
  texto?: string;
  lineas?: 1 | 2;
  className?: string;
}) {
  const textoCompleto = texto === undefined ? extraerTextoPlano(children) : texto.trim();
  const clases = cn("min-w-0 leading-snug break-words", lineas === 1 ? "block truncate" : "line-clamp-2", className);

  const umbralTooltip = lineas === 1 ? UMBRAL_TOOLTIP_UNA_LINEA : UMBRAL_TOOLTIP_DOS_LINEAS;

  if (textoCompleto.length <= umbralTooltip) {
    return (
      <div title={textoCompleto || undefined} className={clases}>
        {children}
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger render={<div title={textoCompleto} className={clases} />}>{children}</TooltipTrigger>
      <TooltipContent className="max-w-xs bg-slate-900 text-xs font-medium break-words whitespace-normal text-white">
        {textoCompleto}
      </TooltipContent>
    </Tooltip>
  );
}
