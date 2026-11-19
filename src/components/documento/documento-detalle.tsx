import type { ReactNode } from "react";

import Link from "next/link";

import { cn } from "cn";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Empresa } from "@/lib/facturacion/tipos";

/**
 * Shell del detalle de un documento que no es de venta (compra, pago, nota,
 * asiento…): "← Volver", título 20 px + estado, acciones, resumen opcional,
 * tarjeta-documento y secciones en pestañas. Sigue `docs/alegra/css-vista/GUIA-VISTA.md`
 * con las mismas medidas que la vista de factura (`documento-venta`), para que
 * todos los detalles hablen el mismo idioma. Es un Server Component: no tiene
 * estado y las acciones/pestañas se pasan como hijos.
 */

/** Tono de la etiqueta de estado del encabezado (GUIA-VISTA §3.3). */
export type TonoEstadoDetalle = "amber" | "green" | "red" | "neutral";

export interface EstadoDetalle {
  etiqueta: string;
  tono: TonoEstadoDetalle;
}

/** Botón con texto del encabezado: 36 px de alto, radio 10 (GUIA-VISTA §5.1). */
export const CLASE_BOTON_DOCUMENTO = "h-9 rounded-[10px] border-slate-400/40 px-4";

const TONOS_ESTADO: Record<TonoEstadoDetalle, string> = {
  amber: "border-amber-700/15 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  green: "border-emerald-700/15 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  red: "border-rose-700/15 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
  neutral: "border-border bg-muted text-muted-foreground",
};

const PESTANA = "h-auto flex-none rounded-none px-6 py-2 text-sm font-normal after:bottom-0 after:bg-primary";

function EtiquetaEstadoDetalle({ etiqueta, tono }: EstadoDetalle) {
  return (
    <Badge variant="outline" className={cn("h-5 rounded-[4px] px-[5px] py-px text-xs font-medium", TONOS_ESTADO[tono])}>
      {etiqueta}
    </Badge>
  );
}

/** Monto del resumen: "Por pagar" en rojo, como la factura (GUIA-VISTA §3.4). */
export interface ItemResumenDetalle {
  etiqueta: string;
  /** Ya formateado con `formatoMoneda`; se muestra con tabular-nums. */
  valor: string;
  peligro?: boolean;
}

function ResumenDetalle({ items }: { items: readonly ItemResumenDetalle[] }) {
  return (
    <Card className="border-border bg-card gap-0 overflow-hidden rounded-2xl border py-0 shadow-none ring-0 [--card-spacing:0px]">
      <div className="flex flex-col md:flex-row">
        {items.map((item) => (
          <div
            key={item.etiqueta}
            className="border-border flex flex-col gap-1 border-b p-4 last:border-b-0 md:flex-1 md:border-r md:border-b-0 md:last:border-r-0"
          >
            <span className="text-muted-foreground text-xs leading-4 font-medium">{item.etiqueta}</span>
            <span
              className={cn(
                "text-xl leading-7 font-semibold text-slate-700 tabular-nums dark:text-slate-200",
                item.peligro && "text-rose-700 dark:text-rose-400",
              )}
            >
              {item.valor}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

interface DocumentoDetalleProps {
  rutaVolver: string;
  etiquetaVolver: string;
  titulo: string;
  estado?: EstadoDetalle;
  acciones?: ReactNode;
  resumen?: readonly ItemResumenDetalle[];
  /** TarjetaDocumento, SeccionesDocumento y lo que siga el patrón. */
  children: ReactNode;
}

export function DocumentoDetalle({
  rutaVolver,
  etiquetaVolver,
  titulo,
  estado,
  acciones,
  resumen,
  children,
}: DocumentoDetalleProps) {
  return (
    <div className="bg-muted/40 -m-4 p-4 md:-m-6 md:p-6">
      <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-6 [font-family:var(--font-inter)]">
        <header>
          <Link href={rutaVolver} className="text-primary mb-2 inline-flex items-center gap-1 text-xs font-medium">
            <ArrowLeft className="size-4" />
            {etiquetaVolver}
          </Link>

          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <h1 className="truncate text-xl leading-7 font-semibold text-slate-900 dark:text-slate-100">{titulo}</h1>
              {estado ? <EtiquetaEstadoDetalle {...estado} /> : null}
            </div>
            {acciones ? <div className="flex flex-wrap items-center gap-2">{acciones}</div> : null}
          </div>
        </header>

        {resumen && resumen.length > 0 ? <ResumenDetalle items={resumen} /> : null}

        {children}
      </div>
    </div>
  );
}

/**
 * Tarjeta del documento (GUIA-VISTA §3.5): logo / empresa / número en 3 tercios
 * y, dentro, la información en grid, la tabla con borde y los totales.
 */
export function TarjetaDocumento({
  empresa,
  numeroDocumento,
  children,
}: {
  empresa: Empresa | null;
  numeroDocumento: string;
  children: ReactNode;
}) {
  const nombreEmpresa = empresa?.nombre?.trim() || "MEDOXIGAS ALC, SRL";
  const logo = empresa?.logo_url?.trim() || "/marca/logo-medoxigas.png";

  return (
    <Card className="bg-card gap-0 rounded-[12px] border border-slate-400/20 py-0 shadow-none ring-0 [--card-spacing:0px]">
      <div className="p-3 text-slate-700 sm:p-5 md:p-8 dark:text-slate-200">
        <header className="mb-[30px] flex flex-col gap-4 py-3 md:flex-row md:items-center md:justify-between md:gap-2 md:py-0">
          <div className="flex w-full justify-center md:w-1/3 md:justify-start">
            <div className="flex h-[117px] w-full max-w-[300px] items-center justify-center overflow-hidden rounded-lg bg-white">
              {/* biome-ignore lint/performance/noImgElement: logo configurable de la empresa */}
              <img src={logo} alt={nombreEmpresa} className="max-h-full max-w-full object-contain" />
            </div>
          </div>

          <div className="w-full text-center md:w-1/3">
            <p className="text-foreground text-base leading-6 font-semibold">{nombreEmpresa}</p>
            {empresa?.rnc?.trim() ? <p className="text-xs leading-4">{empresa.rnc}</p> : null}
            {empresa?.correo?.trim() ? <p className="text-xs leading-4">{empresa.correo}</p> : null}
          </div>

          <div className="w-full md:w-1/3 md:text-right">
            <p className="text-foreground text-base leading-6 font-semibold">No. {numeroDocumento}</p>
          </div>
        </header>

        {children}
      </div>
    </Card>
  );
}

/** Dato de la información del documento: etiqueta arriba (14/500), valor abajo (14/400). */
export interface CampoInformacionDocumento {
  etiqueta: string;
  valor: ReactNode;
}

/** "Información de la factura…": grid de 3 columnas (2 en documentos chicos), gap 32 (GUIA-VISTA §3.7). */
export function InformacionDocumento({
  titulo,
  campos,
  columnas = 3,
}: {
  titulo: string;
  campos: readonly CampoInformacionDocumento[];
  columnas?: 2 | 3;
}) {
  return (
    <section>
      <h2 className="text-foreground mb-4 text-base leading-6 font-semibold">{titulo}</h2>
      <dl className={cn("m-0 grid grid-cols-1 gap-8", columnas === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        {campos.map((campo) => (
          <div key={campo.etiqueta} className="flex min-w-0 flex-col gap-2">
            <dt className="text-sm leading-5 font-medium">{campo.etiqueta}</dt>
            <dd className="m-0 text-sm leading-5">{campo.valor}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Columna de la tabla del documento; las de dinero llevan `alineadaDerecha`. */
export interface ColumnaTablaDocumento {
  titulo: string;
  alineadaDerecha?: boolean;
}

/**
 * Tabla con borde y radio 16 (GUIA-VISTA §3.8): encabezado de 40 px con fondo
 * suave y separadores, filas de 48 px. Con `titulo` es una sección dentro de la
 * tarjeta ("Productos y servicios"); sin título es la tabla pelada de una pestaña.
 * Las filas las escribe la pantalla con `TableRow`/`TableCell`; `pie` va en el tfoot.
 */
export function TablaDocumento({
  titulo,
  columnas,
  vacio,
  hayFilas,
  pie,
  children,
}: {
  titulo?: string;
  columnas: readonly ColumnaTablaDocumento[];
  vacio: string;
  hayFilas: boolean;
  pie?: ReactNode;
  children: ReactNode;
}) {
  const tabla = (
    <div className="border-border overflow-x-auto rounded-2xl border">
      <Table>
        <TableHeader>
          <TableRow>
            {columnas.map((columna, indice) => (
              <TableHead
                key={columna.titulo}
                className={cn(
                  "bg-muted/60 text-foreground relative h-10 px-4 text-xs font-medium whitespace-nowrap",
                  columna.alineadaDerecha && "text-right",
                  indice < columnas.length - 1 &&
                    "after:bg-border after:absolute after:top-2 after:right-0 after:h-[60%] after:w-px",
                )}
              >
                {columna.titulo}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {hayFilas ? (
            children
          ) : (
            <TableRow>
              <TableCell colSpan={columnas.length} className="text-muted-foreground h-24 text-center text-sm">
                {vacio}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        {pie ? <TableFooter>{pie}</TableFooter> : null}
      </Table>
    </div>
  );

  if (!titulo) return tabla;

  return (
    <section className="mt-10">
      <h3 className="text-foreground mb-6 text-base leading-6 font-bold">{titulo}</h3>
      {tabla}
    </section>
  );
}

/** Fila de totales (16 px gris); el total va aparte, en 20 px / 600 (GUIA-VISTA §3.9). */
export interface FilaTotalDocumento {
  etiqueta: string;
  /** Ya formateado con `formatoMoneda`; se muestra con tabular-nums. */
  valor: string;
}

/** Caja de 320 px a la derecha con las filas de totales y el total del documento. */
export function TotalesDocumento({
  filas,
  total,
  etiquetaTotal = "Total",
}: {
  filas: readonly FilaTotalDocumento[];
  total: string;
  etiquetaTotal?: string;
}) {
  return (
    <section className="mt-10 flex md:justify-end">
      <div className="text-muted-foreground w-80 max-w-full text-base">
        {filas.map((fila) => (
          <div key={fila.etiqueta} className="flex h-6 items-center justify-between gap-4">
            <span>{fila.etiqueta}</span>
            <span className="tabular-nums">{fila.valor}</span>
          </div>
        ))}
        <div className="text-foreground mt-7 flex items-center justify-between gap-4 text-xl leading-7 font-semibold">
          <span>{etiquetaTotal}</span>
          <span className="tabular-nums">{total}</span>
        </div>
      </div>
    </section>
  );
}

/** Pestaña de documentos asociados ("Pagos asociados", "Contabilidad"…). */
export interface SeccionDocumento {
  valor: string;
  etiqueta: string;
  contenido: ReactNode;
}

/** Tarjeta con pestañas de línea, como las de la vista de factura (GUIA-VISTA §3.11). */
export function SeccionesDocumento({ secciones }: { secciones: readonly SeccionDocumento[] }) {
  const primera = secciones[0];
  if (!primera) return null;

  return (
    <Card className="bg-card gap-0 rounded-[12px] border border-slate-400/20 px-2 pt-2 pb-6 shadow-none ring-0 [--card-spacing:0px] sm:px-8 sm:pb-8">
      <Tabs defaultValue={primera.valor} className="gap-0">
        <TabsList
          variant="line"
          className="h-auto w-full justify-start gap-0 overflow-x-auto rounded-none border-b border-slate-300 p-0"
        >
          {secciones.map((seccion) => (
            <TabsTrigger key={seccion.valor} value={seccion.valor} className={PESTANA}>
              {seccion.etiqueta}
            </TabsTrigger>
          ))}
        </TabsList>

        {secciones.map((seccion) => (
          <TabsContent key={seccion.valor} value={seccion.valor} className="mt-6">
            {seccion.contenido}
          </TabsContent>
        ))}
      </Tabs>
    </Card>
  );
}
