import { cn } from "cn";

import { Search } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

export interface ParametroOculto {
  nombre: string;
  valor: string;
}

export interface ConfiguracionEncabezadoTablaComparativa {
  /** Ruta del reporte; el formulario GET vuelve a ella con los filtros actuales. */
  accion: string;
  /** "Del 1 al 30 de noviembre: Comparativo 2026 - 2025". */
  etiquetaRango: string;
  busqueda: string;
  parametros?: readonly ParametroOculto[];
}

interface Props extends ConfiguracionEncabezadoTablaComparativa {
  /** Acción del botón de árbol de Alegra; solo la pasan tablas expandibles. */
  onAlternarTodas?: () => void;
  todasContraidas?: boolean;
}

function IconoArrowBarDown({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 20l0 -10" />
      <path d="M12 20l4 -4" />
      <path d="M12 20l-4 -4" />
      <path d="M4 4l16 0" />
    </svg>
  );
}

/**
 * Encabezado de la tarjeta del reporte comparativo: buscador de cuentas a la
 * izquierda y el rango del período a la derecha (patrón del estado de
 * resultados). Los parámetros ocultos conservan fechas, vista y centro.
 */
export function EncabezadoTablaComparativa({
  accion,
  etiquetaRango,
  busqueda,
  parametros = [],
  onAlternarTodas,
  todasContraidas = false,
}: Props) {
  const etiquetaTodas = todasContraidas ? "Expandir todas las cuentas" : "Contraer todas las cuentas";

  return (
    <div className="bg-card border-border flex flex-wrap items-center justify-between gap-3 border-b px-2 py-3">
      <div className="flex items-center gap-2">
        <form method="get" action={accion} className="w-64 max-w-full print:hidden">
          {parametros.map((parametro) => (
            <input key={parametro.nombre} type="hidden" name={parametro.nombre} value={parametro.valor} />
          ))}
          <InputGroup className="border-border bg-card rounded-lg">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              name="q"
              defaultValue={busqueda}
              placeholder="Buscar cuenta contable"
              aria-label="Buscar cuenta contable"
            />
          </InputGroup>
        </form>
        {onAlternarTodas ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title={etiquetaTodas}
            aria-label={etiquetaTodas}
            aria-expanded={!todasContraidas}
            onClick={onAlternarTodas}
            className="size-8 bg-transparent text-slate-600 hover:bg-transparent hover:text-slate-900 aria-expanded:bg-transparent dark:text-slate-300 dark:hover:bg-transparent dark:hover:text-slate-100 print:hidden"
          >
            <IconoArrowBarDown className={cn("size-4 transition-transform", todasContraidas && "rotate-180")} />
          </Button>
        ) : null}
      </div>
      <p className="text-muted-foreground px-1 text-sm">{etiquetaRango}</p>
    </div>
  );
}
