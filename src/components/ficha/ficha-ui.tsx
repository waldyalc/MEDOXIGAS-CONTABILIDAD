"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

import { cn } from "cn";
import { ChevronDown, ChevronLeft, ChevronRight, ListFilter } from "lucide-react";

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
  dataPestana,
}: {
  readonly activo: boolean;
  readonly icono: ReactNode;
  readonly etiqueta: string;
  readonly onClick: () => void;
  readonly dataPestana?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      data-pestana={dataPestana}
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

export interface PestanaFichaItem<T extends string> {
  readonly valor: T;
  readonly etiqueta: string;
  readonly icono: ReactNode;
}

export function PestanasFicha<T extends string>({
  items,
  valor,
  onCambiar,
  ariaLabel,
  className,
}: {
  readonly items: readonly PestanaFichaItem<T>[];
  readonly valor: T;
  readonly onCambiar: (valor: T) => void;
  readonly ariaLabel: string;
  readonly className?: string;
}) {
  const carrilRef = useRef<HTMLDivElement>(null);
  const pistaRef = useRef<HTMLDivElement>(null);
  const [hayAnteriores, setHayAnteriores] = useState(false);
  const [haySiguientes, setHaySiguientes] = useState(false);

  useEffect(() => {
    const carril = carrilRef.current;
    if (!carril) return;

    const actualizar = () => {
      setHayAnteriores(carril.scrollLeft > 1);
      setHaySiguientes(carril.scrollLeft + carril.clientWidth < carril.scrollWidth - 1);
    };

    actualizar();
    carril.addEventListener("scroll", actualizar, { passive: true });
    const observador = new ResizeObserver(actualizar);
    observador.observe(carril);
    if (pistaRef.current) observador.observe(pistaRef.current);

    return () => {
      carril.removeEventListener("scroll", actualizar);
      observador.disconnect();
    };
  }, []);

  useEffect(() => {
    const activa = pistaRef.current?.querySelector<HTMLElement>(`[data-pestana="${valor}"]`);
    activa?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [valor]);

  function mover(direccion: -1 | 1) {
    const carril = carrilRef.current;
    if (!carril) return;
    const paso = Math.max(140, carril.clientWidth * 0.6);
    carril.scrollBy({ left: direccion * paso, behavior: "smooth" });
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-1", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon-xs"
        className="shrink-0"
        aria-label="Ver pestañas anteriores"
        disabled={!hayAnteriores}
        onClick={() => mover(-1)}
      >
        <ChevronLeft />
      </Button>
      <nav aria-label={ariaLabel} className="min-w-0 flex-1">
        <div
          ref={carrilRef}
          className="flex [scrollbar-width:none] overflow-x-auto overscroll-x-contain scroll-smooth [&::-webkit-scrollbar]:hidden"
        >
          <div ref={pistaRef} className="flex w-max items-center gap-1">
            {items.map((item) => (
              <ItemPestana
                key={item.valor}
                dataPestana={item.valor}
                activo={valor === item.valor}
                icono={item.icono}
                etiqueta={item.etiqueta}
                onClick={() => onCambiar(item.valor)}
              />
            ))}
          </div>
        </div>
      </nav>
      <Button
        type="button"
        variant="outline"
        size="icon-xs"
        className="shrink-0"
        aria-label="Ver pestañas siguientes"
        disabled={!haySiguientes}
        onClick={() => mover(1)}
      >
        <ChevronRight />
      </Button>
    </div>
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
