"use client";

import type { MouseEvent } from "react";

import { cn } from "cn";
import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  BookOpen,
  ClipboardList,
  Compass,
  FileMinus,
  FilePlus,
  FileStack,
  FileText,
  Landmark,
  MoreHorizontal,
  Package,
  Receipt,
  ReceiptText,
  Repeat,
  TrendingUp,
  Truck,
  Users,
  Wallet,
} from "lucide-react";

import { PillEstado } from "@/components/listas/tabla-lista";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatoMoneda } from "@/lib/facturacion/formato";

import type { EntidadBusqueda, ResultadoBusqueda } from "./agrupar";

const ICONOS_ENTIDAD: Record<EntidadBusqueda, LucideIcon> = {
  contacto: Users,
  producto: Package,
  factura: ReceiptText,
  nota_credito_venta: FileMinus,
  nota_debito_venta: FilePlus,
  cotizacion: FileStack,
  remision: Truck,
  factura_recurrente: Repeat,
  pago_recibido: Wallet,
  factura_proveedor: Banknote,
  nota_credito_compra: FileMinus,
  orden_compra: ClipboardList,
  pago_proveedor: Wallet,
  gasto_menor: Receipt,
  asiento: BookOpen,
  cuenta: Landmark,
  reporte: TrendingUp,
  navegacion: Compass,
  documento: FileText,
};

const ETIQUETAS_ENTIDAD: Record<EntidadBusqueda, string> = {
  contacto: "Contacto",
  producto: "Producto",
  factura: "Factura",
  nota_credito_venta: "Nota de crédito",
  nota_debito_venta: "Nota de débito",
  cotizacion: "Cotización",
  remision: "Conduce",
  factura_recurrente: "Factura recurrente",
  pago_recibido: "Pago recibido",
  factura_proveedor: "Compra",
  nota_credito_compra: "Nota de crédito de compra",
  orden_compra: "Orden de compra",
  pago_proveedor: "Pago a proveedor",
  gasto_menor: "Gasto menor",
  asiento: "Asiento",
  cuenta: "Cuenta",
  reporte: "Reporte",
  navegacion: "Página",
  documento: "Documento",
};

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

interface Props {
  resultado: ResultadoBusqueda;
  /** Ruta real de la tarjeta; en fase 1 sale de los datos de ejemplo. */
  url: string;
  /** Tarjeta activa por teclado (roving focus, §1.6). */
  activa: boolean;
  /** Móvil: 72 px de alto en vez de 76 (§1.11). */
  compacta?: boolean;
  onAbrir: (resultado: ResultadoBusqueda, url: string) => void;
  onFocus?: () => void;
}

/**
 * Tarjeta de resultado de 313 × 76 px (§1.6): identificador + monto, subtítulo
 * en gris y fila inferior con PillEstado y contexto. Es un `<a>` real para que
 * ⌘/clic y clic central abran pestaña nueva; el clic normal guarda el reciente
 * y cierra la ventana.
 */
export function TarjetaResultado({ resultado, url, activa, compacta = false, onAbrir, onFocus }: Props) {
  function alClickear(evento: MouseEvent<HTMLAnchorElement>) {
    if (evento.defaultPrevented) return;
    // Con ⌘/Ctrl/Shift/clic central el navegador hace la apertura en pestaña nueva.
    if (evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
    evento.preventDefault();
    onAbrir(resultado, url);
  }

  return (
    <a
      href={url}
      data-tarjeta=""
      onClick={alClickear}
      onFocus={onFocus}
      aria-label={etiquetaAria(resultado)}
      className={cn(
        "group bg-card ring-border flex w-full items-start gap-2.5 rounded-xl p-2 ring-1 transition-colors outline-none",
        "focus-visible:ring-ring focus-visible:ring-2",
        "dark:bg-white/[0.03] dark:ring-white/10",
        activa ? "bg-secondary/60 ring-ring ring-2 dark:bg-white/[0.07]" : "hover:ring-ring/40",
        compacta ? "h-[72px]" : "h-[76px]",
      )}
    >
      {resultado.entidad === "contacto" ? (
        <Avatar className="self-center">
          <AvatarFallback className="text-[11px] font-medium">{iniciales(resultado.titulo)}</AvatarFallback>
        </Avatar>
      ) : (
        <IconoEntidad entidad={resultado.entidad} />
      )}

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-[13px] leading-4 font-semibold">{resultado.titulo}</span>
          {resultado.monto != null ? (
            <span className="ml-auto shrink-0 text-[13px] leading-4 font-medium tabular-nums">
              {formatoMoneda(resultado.monto)}
            </span>
          ) : null}
        </span>
        {resultado.subtitulo ? (
          <span className="text-muted-foreground truncate text-xs leading-3.5">{resultado.subtitulo}</span>
        ) : null}
        <span className="flex min-w-0 items-center gap-1.5">
          {resultado.estado ? <PillEstado tono={resultado.estado.tono}>{resultado.estado.texto}</PillEstado> : null}
          {resultado.etiquetas.length > 0 ? (
            <span className="text-muted-foreground truncate text-[11px]">{resultado.etiquetas.join(" · ")}</span>
          ) : null}
        </span>
      </span>

      <AccionesTarjeta resultado={resultado} url={url} onAbrir={onAbrir} />
    </a>
  );
}

/** Avatar cuadrado de icono por tipo de documento (§1.6). */
function IconoEntidad({ entidad }: { entidad: EntidadBusqueda }) {
  const Icono = ICONOS_ENTIDAD[entidad];
  return (
    <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md">
      <Icono className="size-4" />
    </span>
  );
}

/** Menú «⋯» de 28 px: visible al hover y al foco (§1.6). */
function AccionesTarjeta({
  resultado,
  url,
  onAbrir,
}: {
  resultado: ResultadoBusqueda;
  url: string;
  onAbrir: (resultado: ResultadoBusqueda, url: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Acciones de ${resultado.titulo}`}
            className="size-7 shrink-0 self-start opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100"
          />
        }
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {/* TODO: acciones por entidad (copiar NCF, ver asiento…) cuando exista la RPC (§2.3). */}
        <DropdownMenuItem onClick={() => onAbrir(resultado, url)}>
          <Compass />
          Abrir
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => window.open(url, "_blank", "noopener")}>
          <FileStack />
          Abrir en pestaña nueva
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function iniciales(titulo: string): string {
  const partes = titulo.trim().split(/\s+/);
  const primera = partes[0]?.[0] ?? "?";
  const segunda = partes[1]?.[0] ?? "";
  return `${primera}${segunda}`.toUpperCase();
}

/** Etiqueta de accesibilidad completa (§1.10): «Factura B0100000123, Pedro Pérez…, RD$ 4,500, cobrada». */
function etiquetaAria(resultado: ResultadoBusqueda): string {
  const partes = [`${ETIQUETAS_ENTIDAD[resultado.entidad]} ${resultado.titulo}`];
  if (resultado.subtitulo) partes.push(resultado.subtitulo);
  else if (resultado.fecha != null) partes.push(fechaLarga(resultado.fecha));
  if (resultado.monto != null) partes.push(formatoMoneda(resultado.monto));
  if (resultado.estado) partes.push(resultado.estado.texto.toLowerCase());
  return partes.join(", ");
}

function fechaLarga(iso: string): string {
  const [anio, mes, dia] = iso.slice(0, 10).split("-");
  const nombreMes = mes == null ? null : MESES[Number(mes) - 1];
  if (!anio || !nombreMes || !dia) return iso;
  return `${Number(dia)} de ${nombreMes} de ${anio}`;
}
