"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { cn } from "cn";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type ParametrosLista, type ResumenPagina, TAMANO_PAGINA_DEFECTO, urlLista } from "@/lib/listas/parametros";

const formato = new Intl.NumberFormat("es-DO");

interface Props {
  base: string;
  params: ParametrosLista;
  resumen: ResumenPagina;
  className?: string;
  /** Texto que precede al selector de tamaño, p. ej. "Ítems por página". */
  etiqueta?: string;
  /** Tamaño actual de la página. Default 25 (no cambia el de las listas existentes). */
  tamano?: number;
  /** Ofrece el selector de tamaño solo si se pasa esta lista. */
  opciones?: readonly number[];
  /** Permite ocultar el pie desde la página. */
  visible?: boolean;
  /** Con total 0 el pie se conserva (búsqueda sin resultados), como en Facturas. */
  mostrarEnVacio?: boolean;
  /** ‹‹ ›› en los extremos. Default true para no cambiar las listas existentes. */
  botonesExtremos?: boolean;
}

function TextoRango({ inicio, fin, total, prefijo }: { inicio: number; fin: number; total: number; prefijo?: string }) {
  return (
    <p className="text-muted-foreground tabular-nums">
      {prefijo ? `${prefijo} ` : null}
      {formato.format(inicio)}–{formato.format(fin)} de {formato.format(total)}
    </p>
  );
}

function ControlesPagina({
  pagina,
  totalPaginas,
  anterior,
  siguiente,
  primera,
  ultima,
  botonesExtremos,
}: {
  pagina: number;
  totalPaginas: number;
  anterior: string | null;
  siguiente: string | null;
  primera: string | null;
  ultima: string | null;
  botonesExtremos: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {botonesExtremos ? (
        <Button
          variant="outline"
          size="icon-sm"
          disabled={primera === null}
          aria-label="Primera página"
          render={primera ? <Link href={primera} prefetch={false} /> : undefined}
        >
          <ChevronsLeft />
        </Button>
      ) : null}
      <Button
        variant="outline"
        size="icon-sm"
        disabled={anterior === null}
        aria-label="Página anterior"
        render={anterior ? <Link href={anterior} prefetch={false} /> : undefined}
      >
        <ChevronLeft />
      </Button>
      <span className="text-muted-foreground min-w-28 text-center tabular-nums">
        Página {formato.format(pagina)} de {formato.format(totalPaginas)}
      </span>
      <Button
        variant="outline"
        size="icon-sm"
        disabled={siguiente === null}
        aria-label="Página siguiente"
        render={siguiente ? <Link href={siguiente} prefetch={false} /> : undefined}
      >
        <ChevronRight />
      </Button>
      {botonesExtremos ? (
        <Button
          variant="outline"
          size="icon-sm"
          disabled={ultima === null}
          aria-label="Última página"
          render={ultima ? <Link href={ultima} prefetch={false} /> : undefined}
        >
          <ChevronsRight />
        </Button>
      ) : null}
    </div>
  );
}

export function PaginadorLista({
  base,
  params,
  resumen,
  className,
  etiqueta = "Ítems por página",
  tamano = TAMANO_PAGINA_DEFECTO,
  opciones,
  visible = true,
  mostrarEnVacio = false,
  botonesExtremos = true,
}: Props) {
  const router = useRouter();

  if (!visible || (resumen.total === 0 && !mostrarEnVacio)) return null;

  const { pagina, totalPaginas, inicio, fin, total } = resumen;
  const anterior = pagina > 1 ? urlLista(base, params, { pagina: String(pagina - 1) }) : null;
  const siguiente = pagina < totalPaginas ? urlLista(base, params, { pagina: String(pagina + 1) }) : null;
  const primera = pagina > 1 ? urlLista(base, params, { pagina: "1" }) : null;
  const ultima = pagina < totalPaginas ? urlLista(base, params, { pagina: String(totalPaginas) }) : null;

  function cambiarTamano(valor: string | null) {
    if (valor === null || valor === String(tamano)) return;
    router.replace(urlLista(base, params, { tamano: valor, pagina: null }), { scroll: false });
  }

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 text-sm", className)}>
      {opciones ? (
        <div className="flex flex-wrap items-center gap-2">
          <span>{etiqueta}</span>
          <Select value={String(tamano)} onValueChange={cambiarTamano}>
            <SelectTrigger className="h-8 w-20" aria-label={etiqueta}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {opciones.map((opcion) => (
                <SelectItem key={opcion} value={String(opcion)}>
                  {opcion}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <TextoRango inicio={inicio} fin={fin} total={total} />
        </div>
      ) : (
        <TextoRango prefijo="Mostrando" inicio={inicio} fin={fin} total={total} />
      )}
      <ControlesPagina
        pagina={pagina}
        totalPaginas={totalPaginas}
        anterior={anterior}
        siguiente={siguiente}
        primera={primera}
        ultima={ultima}
        botonesExtremos={botonesExtremos}
      />
    </div>
  );
}
