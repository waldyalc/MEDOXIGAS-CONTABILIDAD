import type { ReactNode } from "react";

import { cn } from "cn";

import { FilaNavegable } from "@/components/listas/fila-navegable";
import { TextoTruncado } from "@/components/listas/texto-truncado";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type TonoPill = "exito" | "pendiente" | "peligro" | "neutro" | "info";
export type Alineacion = "izquierda" | "derecha" | "centro";

export interface ColumnaLista<T> {
  clave: string;
  encabezado: ReactNode;
  celda: (fila: T) => ReactNode;
  /** Default "izquierda". Los montos van a la derecha. */
  alineacion?: Alineacion;
  /** Ancho y responsive: "w-24", "hidden lg:table-cell". */
  className?: string;
  truncar?: boolean | "1" | "2";
}

export interface VacioLista {
  titulo: string;
  descripcion?: string;
  icono?: ReactNode;
  /** Botón "Crear…" solo si el rol puede escribir. */
  accion?: ReactNode;
  /** true = búsqueda/filtro sin resultados: nunca muestra la acción. */
  filtrada?: boolean;
}

const ALINEACION: Record<Alineacion, string> = {
  izquierda: "text-left",
  derecha: "text-right tabular-nums",
  centro: "text-center",
};

const TONOS_PILL: Record<TonoPill, string> = {
  exito: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
  pendiente: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  peligro: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  neutro: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
  info: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
};

const CLAVES_TEXTO_LARGO = new Set([
  "proveedor",
  "cliente",
  "contacto",
  "tercero",
  "nombre",
  "descripcion",
  "concepto",
  "producto",
  "almacen",
  "categoria",
  "motivo",
  "cuenta",
  "vendedor",
  "referencia",
  "ncf",
]);

function lineasTruncado<T>(columna: ColumnaLista<T>): 1 | 2 | null {
  if (columna.truncar === false) return null;
  if (columna.truncar === "1") return 1;
  if (columna.truncar === "2") return 2;
  if (columna.truncar !== true && !CLAVES_TEXTO_LARGO.has(columna.clave)) return null;
  return columna.clave === "ncf" ? 1 : 2;
}

function claseAnchoTexto(clave: string): string {
  return clave === "ncf" ? "max-w-[140px]" : "min-w-[155px] max-w-[210px]";
}

export function TarjetaLista({
  children,
  className,
  "data-lista": dataLista,
}: {
  children: ReactNode;
  className?: string;
  /** Identificador para los e2e, p. ej. "facturas". */
  "data-lista"?: string;
}) {
  return (
    <div data-lista={dataLista} className={cn("bg-card border-border overflow-hidden rounded-2xl border", className)}>
      {children}
    </div>
  );
}

export function BarraLista({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("border-border flex h-14 items-center gap-2 border-b px-4", className)}>{children}</div>;
}

/** Centra la lista y evita que la tarjeta se estire en pantallas anchas (≈1289 px). */
export function ContenedorLista({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto flex w-full max-w-[1289px] flex-col gap-4", className)}>{children}</div>;
}

function ContenidoVacio({ titulo, descripcion, icono, accion, filtrada }: VacioLista) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      {icono ? <div className="text-slate-300 dark:text-slate-600">{icono}</div> : null}
      <p className="text-lg font-semibold">{titulo}</p>
      {descripcion ? <p className="text-muted-foreground text-sm">{descripcion}</p> : null}
      {!filtrada && accion ? <div className="pt-3">{accion}</div> : null}
    </div>
  );
}

export function EstadoVacioLista(props: VacioLista) {
  return (
    <div className="bg-card border-border rounded-2xl border px-6 py-16">
      <ContenidoVacio {...props} />
    </div>
  );
}

/** Aire del patrón: 10 px por celda y 16 px en los bordes para evitar scroll horizontal en 9 columnas. */
function clasesEspaciado(compacta: boolean, esPrimera: boolean, esUltima: boolean): string {
  if (compacta) return "px-2.5";
  return cn("px-2.5", esPrimera && "pl-4", esUltima && "pr-4");
}

function FilaLista<T>({
  fila,
  columnas,
  seleccion,
  acciones,
  compacta,
  href,
}: {
  fila: T;
  columnas: readonly ColumnaLista<T>[];
  seleccion?: { cabecera: ReactNode; celda: (fila: T) => ReactNode };
  acciones?: (fila: T) => ReactNode;
  compacta: boolean;
  href?: string | null;
}) {
  const totalCeldas = columnas.length + (seleccion ? 1 : 0) + (acciones ? 1 : 0);
  const clasesFila = cn(
    compacta ? "h-11" : "h-14",
    "border-border border-b hover:bg-slate-200/45 dark:hover:bg-slate-800/40",
  );

  const celdas = (
    <>
      {seleccion ? (
        <TableCell className={clasesEspaciado(compacta, true, totalCeldas === 1)}>{seleccion.celda(fila)}</TableCell>
      ) : null}
      {columnas.map((columna, indice) => {
        const posicion = indice + (seleccion ? 1 : 0);
        const lineas = lineasTruncado(columna);
        const contenido = columna.celda(fila);
        return (
          <TableCell
            key={columna.clave}
            className={cn(
              compacta ? "text-[13px]" : "text-sm",
              clasesEspaciado(compacta, posicion === 0, posicion === totalCeldas - 1),
              "text-slate-700 dark:text-slate-300",
              ALINEACION[columna.alineacion ?? "izquierda"],
              columna.className,
              lineas ? cn("py-2 whitespace-normal", claseAnchoTexto(columna.clave)) : "whitespace-nowrap",
            )}
          >
            {lineas ? (
              <TextoTruncado lineas={lineas} className={claseAnchoTexto(columna.clave)}>
                {contenido}
              </TextoTruncado>
            ) : (
              contenido
            )}
          </TableCell>
        );
      })}
      {acciones ? (
        <TableCell className={cn(clasesEspaciado(compacta, totalCeldas === 1, true), "text-center")}>
          {acciones(fila)}
        </TableCell>
      ) : null}
    </>
  );

  if (href) {
    return (
      <FilaNavegable href={href} className={clasesFila}>
        {celdas}
      </FilaNavegable>
    );
  }

  return <TableRow className={clasesFila}>{celdas}</TableRow>;
}

export function TablaLista<T>({
  columnas,
  filas,
  claveFila,
  vacio,
  seleccion,
  acciones,
  pie,
  filaHref,
  densidad = "normal",
  className,
}: {
  columnas: readonly ColumnaLista<T>[];
  filas: readonly T[];
  claveFila: (fila: T) => string;
  vacio: VacioLista;
  /** URL de la ficha de cada fila (la misma del enlace de la primera columna); null/undefined = fila no clicable. */
  filaHref?: (fila: T) => string | null | undefined;
  /** Checkbox ya renderizado (cabecera y celda). */
  seleccion?: { cabecera: ReactNode; celda: (fila: T) => ReactNode };
  /** Columna final de 88 px con las acciones de la fila. */
  acciones?: (fila: T) => ReactNode;
  /** Filas del TableFooter de totales; el componente no las inventa. */
  pie?: ReactNode;
  densidad?: "normal" | "compacta";
  className?: string;
}) {
  const compacta = densidad === "compacta";
  const colSpan = columnas.length + (seleccion ? 1 : 0) + (acciones ? 1 : 0);

  return (
    <Table className={cn("text-sm text-slate-700 dark:text-slate-300", className)}>
      <TableHeader>
        <TableRow className="border-border h-12 border-b bg-slate-200/20 hover:bg-slate-200/20 dark:bg-slate-800/40 dark:hover:bg-slate-800/40">
          {seleccion ? (
            <TableHead className={cn("h-12 w-12", clasesEspaciado(false, true, colSpan === 1))}>
              {seleccion.cabecera}
            </TableHead>
          ) : null}
          {columnas.map((columna, indice) => {
            const posicion = indice + (seleccion ? 1 : 0);
            const lineas = lineasTruncado(columna);
            return (
              <TableHead
                key={columna.clave}
                scope="col"
                className={cn(
                  "h-12 text-xs font-medium text-slate-700 dark:text-slate-300",
                  clasesEspaciado(false, posicion === 0, posicion === colSpan - 1),
                  ALINEACION[columna.alineacion ?? "izquierda"],
                  columna.className,
                  lineas ? claseAnchoTexto(columna.clave) : null,
                )}
              >
                {columna.encabezado}
              </TableHead>
            );
          })}
          {acciones ? (
            <TableHead className={cn("h-12 w-[88px] text-center", clasesEspaciado(false, colSpan === 1, true))}>
              <span className="sr-only">Acciones</span>
            </TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {filas.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={colSpan} className="px-6 py-16">
              <ContenidoVacio {...vacio} />
            </TableCell>
          </TableRow>
        ) : (
          filas.map((fila) => (
            <FilaLista
              key={claveFila(fila)}
              fila={fila}
              columnas={columnas}
              seleccion={seleccion}
              acciones={acciones}
              compacta={compacta}
              href={filaHref?.(fila)}
            />
          ))
        )}
      </TableBody>
      {pie ? <TableFooter>{pie}</TableFooter> : null}
    </Table>
  );
}

export function PillEstado({ tono, children }: { tono: TonoPill; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-[9px] pt-1.5 pb-1 text-[11px] leading-[1.3]",
        TONOS_PILL[tono],
      )}
    >
      {children}
    </span>
  );
}
