"use client";

import { type ReactNode, useState } from "react";

import { cn } from "cn";
import { ChevronDown, ListFilter } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const TH = "text-muted-foreground text-xs font-medium tracking-wider uppercase";

export const CLASE_PANEL_FICHA = "bg-card ring-foreground/10 rounded-xl ring-1";

export function MetaItem({ icono, texto }: { readonly icono: ReactNode; readonly texto: string }) {
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
      {icono}
      {texto}
    </span>
  );
}

export function usePagina(total: number, porPagina: number): { pagina: number; setPagina: (p: number) => void } {
  const [pagina, setPagina] = useState(0);
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  return { pagina: Math.min(pagina, paginas - 1), setPagina };
}

export function PiePagina({
  total,
  porPagina,
  pagina,
  setPagina,
  unidad,
}: {
  readonly total: number;
  readonly porPagina: number;
  readonly pagina: number;
  readonly setPagina: (p: number) => void;
  readonly unidad: string;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const enPagina = Math.max(0, Math.min(porPagina, total - pagina * porPagina));
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-muted-foreground text-sm">
        Mostrando {enPagina} de {total} {unidad}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>
          Anterior
        </Button>
        <Button variant="outline" size="sm" disabled={pagina >= paginas - 1} onClick={() => setPagina(pagina + 1)}>
          Siguiente
        </Button>
      </div>
    </div>
  );
}

export interface OpcionFiltro {
  readonly valor: string;
  readonly etiqueta: string;
}

export function BotonFiltro({
  valor,
  opciones,
  onCambiar,
}: {
  readonly valor: string;
  readonly opciones: readonly OpcionFiltro[];
  readonly onCambiar: (valor: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        <ListFilter data-icon="inline-start" />
        Filtrar
        <ChevronDown data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuRadioGroup value={valor} onValueChange={(nuevo) => onCambiar(String(nuevo))}>
          {opciones.map((opcion) => (
            <DropdownMenuRadioItem key={opcion.valor} value={opcion.valor}>
              {opcion.etiqueta}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ItemPestana({
  activo,
  icono,
  etiqueta,
  onClick,
}: {
  readonly activo: boolean;
  readonly icono: ReactNode;
  readonly etiqueta: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={cn(
        "text-muted-foreground hover:text-foreground relative inline-flex h-11 shrink-0 items-center gap-1.5 px-3 text-sm whitespace-nowrap font-medium transition-colors",
        activo && "text-primary hover:text-primary",
      )}
    >
      {icono}
      {etiqueta}
      <span
        className={cn(
          "bg-primary absolute inset-x-3 bottom-0 h-0.5 rounded-t-full opacity-0 transition-opacity",
          activo && "opacity-100",
        )}
      />
    </button>
  );
}

export function ItemDato({ etiqueta, children }: { readonly etiqueta: string; readonly children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs">{etiqueta}</dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  );
}

export type TonoKpi = "normal" | "positivo" | "pendiente";

const CLASE_TONO_KPI: Record<TonoKpi, string> = {
  normal: "text-foreground",
  positivo: "text-emerald-600 dark:text-emerald-400",
  pendiente: "text-red-500",
};

export const CLASE_COLS_KPI: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-3 lg:grid-cols-5",
  6: "sm:grid-cols-3 lg:grid-cols-6",
  7: "sm:grid-cols-4 lg:grid-cols-7",
};

export interface KpiFicha {
  readonly etiqueta: string;
  readonly valor: string;
  readonly tono: TonoKpi;
}

export function TarjetaKpi({ etiqueta, valor, tono }: KpiFicha) {
  return (
    <div className="ring-foreground/10 bg-card flex flex-col gap-0.5 rounded-xl px-4 py-3 ring-1">
      <span className="text-muted-foreground text-xs">{etiqueta}</span>
      <span className={cn("text-lg font-semibold tabular-nums", CLASE_TONO_KPI[tono])}>{valor}</span>
    </div>
  );
}

export function GrillaKpis({ kpis }: { readonly kpis: readonly KpiFicha[] }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3", CLASE_COLS_KPI[kpis.length] ?? "lg:grid-cols-4")}>
      {kpis.map((kpi) => (
        <TarjetaKpi key={kpi.etiqueta} {...kpi} />
      ))}
    </div>
  );
}
