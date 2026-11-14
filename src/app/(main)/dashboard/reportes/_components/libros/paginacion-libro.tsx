import type { ReactNode } from "react";

import Link from "next/link";

import { SelectCampo } from "@/components/select-campo";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { construirUrl, type ValorParametro } from "@/lib/reportes/libros/parametros";

const OPCIONES_POR_PAGINA = [
  { value: "10", label: "10" },
  { value: "25", label: "25" },
  { value: "50", label: "50" },
];

interface Props {
  ruta: string;
  parametros: Record<string, ValorParametro>;
  pagina: number;
  porPagina: number;
  totalPaginas: number;
  rangoTexto: string;
}

function EntradasOcultas({ parametros }: { parametros: Record<string, ValorParametro> }) {
  const entradas: ReactNode[] = [];

  for (const [clave, valor] of Object.entries(parametros)) {
    if (valor == null || valor === "" || valor === false || clave === "pagina" || clave === "porPagina") {
      continue;
    }

    if (Array.isArray(valor)) {
      valor.forEach((item, indice) => {
        if (item) entradas.push(<input key={`${clave}-${indice}`} type="hidden" name={clave} value={item} />);
      });
      continue;
    }

    entradas.push(<input key={clave} type="hidden" name={clave} value={valor === true ? "1" : String(valor)} />);
  }

  return <>{entradas}</>;
}

export function PaginacionLibro({ ruta, parametros, pagina, porPagina, totalPaginas, rangoTexto }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <form method="get" className="flex items-end gap-2">
        <EntradasOcultas parametros={parametros} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="porPagina" className="text-muted-foreground text-xs">
            Ítems por página
          </Label>
          <SelectCampo
            id="porPagina"
            name="porPagina"
            opciones={OPCIONES_POR_PAGINA}
            valorInicial={String(porPagina)}
            className="w-24"
          />
        </div>
        <Button type="submit" variant="secondary" size="sm">
          Aplicar
        </Button>
      </form>

      <div className="flex items-center gap-3">
        <span className="text-muted-foreground text-sm tabular-nums">{rangoTexto}</span>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          disabled={pagina <= 1}
          render={
            <Link
              href={construirUrl(ruta, { ...parametros, pagina: Math.max(1, pagina - 1), porPagina })}
              aria-disabled={pagina <= 1}
            />
          }
        >
          Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          disabled={pagina >= totalPaginas}
          render={
            <Link
              href={construirUrl(ruta, {
                ...parametros,
                pagina: Math.min(totalPaginas, pagina + 1),
                porPagina,
              })}
              aria-disabled={pagina >= totalPaginas}
            />
          }
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}
