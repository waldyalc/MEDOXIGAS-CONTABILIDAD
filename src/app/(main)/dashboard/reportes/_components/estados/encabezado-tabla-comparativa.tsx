import { Search } from "lucide-react";

import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

export interface ParametroOculto {
  nombre: string;
  valor: string;
}

interface Props {
  /** Ruta del reporte; el formulario GET vuelve a ella con los filtros actuales. */
  accion: string;
  /** "Del 1 al 30 de noviembre: Comparativo 2026 - 2025". */
  etiquetaRango: string;
  busqueda: string;
  parametros?: readonly ParametroOculto[];
}

/**
 * Encabezado de la tarjeta del reporte comparativo: buscador de cuentas a la
 * izquierda y el rango del período a la derecha (patrón del estado de
 * resultados). Los parámetros ocultos conservan fechas, vista y centro.
 */
export function EncabezadoTablaComparativa({ accion, etiquetaRango, busqueda, parametros = [] }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
      <form method="get" action={accion} className="w-full max-w-72 print:hidden">
        {parametros.map((parametro) => (
          <input key={parametro.nombre} type="hidden" name={parametro.nombre} value={parametro.valor} />
        ))}
        <InputGroup>
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
      <p className="text-muted-foreground text-sm">{etiquetaRango}</p>
    </div>
  );
}
