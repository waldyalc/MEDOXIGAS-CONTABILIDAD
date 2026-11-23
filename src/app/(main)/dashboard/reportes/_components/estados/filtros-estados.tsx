"use client";

import { usePathname, useRouter } from "next/navigation";

import { cn } from "cn";

import { ChevronDown, FileBarChart, RefreshCw, Tag } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { CentroCostoOpcion } from "@/lib/centros-costo/tipos";
import type { Vista } from "@/lib/reportes/estados/tipos";

import { SelectorFechaCorte, SelectorRangoFechas } from "../selector-fechas";

interface Props {
  tipo: "rango" | "fecha";
  desde?: string;
  hasta: string;
  vista?: Vista;
  busqueda: string;
  centrosCosto?: CentroCostoOpcion[];
  centroSeleccionado?: string;
  /** El reporte pone el buscador dentro de la tarjeta de la tabla. */
  ocultarBusqueda?: boolean;
}

/** Chip de filtro estilo Alegra (`s-chip selected`): píldora con tinte teal. */
const CLASE_CHIP =
  "h-8 gap-1.5 rounded-full border border-primary/50 bg-secondary px-3 text-xs font-normal text-secondary-foreground hover:border-primary/60 hover:bg-[#dbe6fa] [&_svg]:size-4";

const ETIQUETAS_VISTA: Record<Vista, string> = {
  detallado: "Reporte detallado",
  resumido: "Reporte resumido",
};

function ChipFiltro({
  icono: Icono,
  etiqueta,
  "aria-label": ariaLabel,
}: {
  readonly icono: typeof Tag;
  readonly etiqueta: string;
  readonly "aria-label"?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      aria-label={ariaLabel ?? etiqueta}
      className={cn(CLASE_CHIP, "w-full md:w-auto")}
    >
      <Icono />
      <span className="truncate">{etiqueta}</span>
      <ChevronDown />
    </Button>
  );
}

export function FiltrosEstados({
  tipo,
  desde,
  hasta,
  vista,
  busqueda,
  centrosCosto = [],
  centroSeleccionado = "",
  ocultarBusqueda = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const centroActual = centrosCosto.find((centro) => centro.id === centroSeleccionado);

  function navegar(cambios: Record<string, string>) {
    const parametros = new URLSearchParams(window.location.search);
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === "") parametros.delete(clave);
      else parametros.set(clave, valor);
    }
    parametros.delete("pagina");
    const consulta = parametros.toString();
    router.push(consulta === "" ? pathname : `${pathname}?${consulta}`);
  }

  return (
    <form method="get" className="flex flex-wrap items-center gap-3 print:hidden">
      {vista != null ? <input type="hidden" name="vista" value={vista} /> : null}
      <input type="hidden" name="centro" value={centroSeleccionado} />

      {tipo === "rango" && desde != null ? (
        <SelectorRangoFechas desde={desde} hasta={hasta} className="w-full md:w-auto" />
      ) : (
        <SelectorFechaCorte valor={hasta} className="w-full md:w-auto" />
      )}

      {centrosCosto.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <ChipFiltro
                icono={Tag}
                etiqueta={centroActual?.nombre ?? "Centro de costos"}
                aria-label="Centro de costos"
              />
            }
          />
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => navegar({ centro: "" })}>Todos los centros</DropdownMenuItem>
            {centrosCosto.map((centro) => (
              <DropdownMenuItem key={centro.id} onClick={() => navegar({ centro: centro.id })}>
                {centro.codigo} · {centro.nombre}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {vista != null ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <ChipFiltro
                icono={FileBarChart}
                etiqueta={`Vista: ${ETIQUETAS_VISTA[vista]}`}
                aria-label="Vista del reporte"
              />
            }
          />
          <DropdownMenuContent align="start">
            {(Object.keys(ETIQUETAS_VISTA) as Vista[]).map((opcion) => (
              <DropdownMenuItem key={opcion} onClick={() => navegar({ vista: opcion })}>
                {ETIQUETAS_VISTA[opcion]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {ocultarBusqueda ? (
        <input type="hidden" name="q" value={busqueda} />
      ) : (
        <Input
          id="q"
          name="q"
          type="search"
          defaultValue={busqueda}
          placeholder="Buscar cuenta contable"
          aria-label="Buscar cuenta contable"
          className="h-8 w-full rounded-full text-xs md:w-56"
        />
      )}

      <Button
        type="submit"
        variant="ghost"
        className="text-primary hover:bg-secondary ml-auto h-8 gap-1.5 rounded-full px-2 text-xs font-medium hover:text-[#0a2352] [&_svg]:size-4"
      >
        <RefreshCw />
        Actualizar
      </Button>
    </form>
  );
}
