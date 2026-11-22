"use client";

import { useState } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "cn";

import {
  ArrowUpRight,
  CircleDollarSign,
  Clock,
  HandCoins,
  History,
  House,
  type LucideIcon,
  Menu,
  Package,
  Pin,
  PinOff,
  RotateCcw,
  Settings,
  Store,
  Users,
  Wallet,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

import { EstadoTurnoPos } from "./estado-turno-pos";
import { claseIconoMenu, itemMenuActivo, itemMenuBase, itemMenuColapsado, itemMenuSeccion } from "./menu-pos-estilos";
import { SalirPos } from "./salir-pos";
import { SelectorTerminal } from "./selector-terminal";
import { UsuarioPos } from "./usuario-pos";

interface ItemEnlacePOS {
  id: string;
  etiqueta: string;
  icono: LucideIcon;
  href: string;
  /** Abre en pestaña nueva (sale del POS hacia Contabilidad). */
  externo?: boolean;
}

interface ItemSeccionPOS {
  id: string;
  etiqueta: string;
  icono: LucideIcon;
  sub: ItemEnlacePOS[];
}

type ItemPOS = ItemEnlacePOS | ItemSeccionPOS;

const ITEMS_PRINCIPALES: ItemPOS[] = [
  { id: "facturar", etiqueta: "Facturar", icono: House, href: "/pos" },
  {
    id: "ingresos",
    etiqueta: "Ingresos",
    icono: HandCoins,
    sub: [
      { id: "historial-ventas", etiqueta: "Historial de ventas", icono: History, href: "/pos/historial" },
      { id: "registro-pagos", etiqueta: "Registro de pagos", icono: CircleDollarSign, href: "/pos/pagos" },
    ],
  },
  {
    id: "turnos",
    etiqueta: "Turnos",
    icono: Wallet,
    sub: [{ id: "historial-turnos", etiqueta: "Historial de turnos", icono: Clock, href: "/pos/turnos" }],
  },
  { id: "devoluciones", etiqueta: "Devoluciones", icono: RotateCcw, href: "/pos/devoluciones" },
];

const ITEMS_CONTABILIDAD: ItemEnlacePOS[] = [
  { id: "contactos", etiqueta: "Contactos", icono: Users, href: "/dashboard/contactos", externo: true },
  { id: "inventario", etiqueta: "Inventario", icono: Package, href: "/dashboard/productos", externo: true },
  {
    id: "configuraciones",
    etiqueta: "Configuraciones",
    icono: Settings,
    href: "/dashboard/configuracion/pos",
    externo: true,
  },
];

function esActivo(pathname: string, href: string): boolean {
  return href === "/pos" ? pathname === "/pos" : pathname === href || pathname.startsWith(`${href}/`);
}

function esSeccion(item: ItemPOS): item is ItemSeccionPOS {
  return "sub" in item;
}

function IconoItem({ icono: Icono, activo }: { icono: LucideIcon; activo?: boolean }) {
  return <Icono aria-hidden="true" className={claseIconoMenu(activo ?? false)} />;
}

export interface MenuPosProps {
  empresa: { nombre: string | null; logo_url: string | null };
  terminales: { id: string; nombre: string }[];
  terminal: { id: string; nombre: string };
  turno: { numero: number; estado: "abierto" | "cerrado"; abierto_en: string } | null;
  usuario: { nombre: string | null; correo: string | null };
}

/**
 * Navegación del POS estilo Alegra: riel de 56 px que expande un panel de
 * 271 px al hover/foco (con pin para dejarlo fijo) y, en móvil, un cajón de
 * 271 px con velo que se abre desde la barra mínima superior.
 */
export function MenuPos({ empresa, terminales, terminal, turno, usuario }: MenuPosProps) {
  const [fijado, setFijado] = useState(false);
  const [sobre, setSobre] = useState(false);
  const [focoDentro, setFocoDentro] = useState(false);
  const [movilAbierto, setMovilAbierto] = useState(false);

  const expandido = fijado || sobre || focoDentro;
  const nombre = empresa.nombre?.trim() || "Punto de venta";

  return (
    <>
      {/* Barra mínima móvil */}
      <header className="border-border bg-card flex h-14 shrink-0 items-center gap-2 border-b px-3 lg:hidden print:hidden">
        <Button
          variant="outline"
          size="icon"
          className="size-10"
          aria-label="Abrir menú del punto de venta"
          onClick={() => setMovilAbierto(true)}
        >
          <Menu className="size-5" aria-hidden="true" />
        </Button>
        {empresa.logo_url ? (
          // biome-ignore lint/performance/noImgElement: logo configurable de la empresa
          <img src={empresa.logo_url} alt={nombre} className="size-8 shrink-0 rounded object-contain" />
        ) : (
          <Store className="text-primary size-6 shrink-0" aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={nombre}>
          {nombre}
        </span>
      </header>

      {/* Riel escritorio: 56 px; el panel de 271 px flota al hover/foco o queda fijo con el pin. */}
      <div
        className={cn(
          "relative hidden shrink-0 transition-[width] duration-300 lg:block print:hidden",
          fijado ? "w-[271px]" : "w-[52px]",
        )}
      >
        <aside
          aria-label="Menú del punto de venta"
          onMouseEnter={() => setSobre(true)}
          onMouseLeave={() => setSobre(false)}
          onFocusCapture={() => setFocoDentro(true)}
          onBlurCapture={(evento) => {
            if (!evento.currentTarget.contains(evento.relatedTarget as Node | null)) setFocoDentro(false);
          }}
          className={cn(
            "bg-sidebar border-sidebar-border absolute inset-y-0 left-0 z-40 flex w-[52px] flex-col overflow-hidden border-r transition-[width,box-shadow] duration-300",
            expandido ? "w-[271px]" : "w-[52px]",
            expandido && !fijado && "shadow-md",
          )}
        >
          <ContenidoMenuPos
            empresa={empresa}
            terminales={terminales}
            terminal={terminal}
            turno={turno}
            usuario={usuario}
            expandido={expandido}
            fijado={fijado}
            mostrarPin
            onAlternarFijado={() => setFijado((actual) => !actual)}
          />
        </aside>
      </div>

      {/* Cajón móvil */}
      <Sheet open={movilAbierto} onOpenChange={setMovilAbierto}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="bg-sidebar w-[271px] gap-0 border-r-0 p-0 sm:max-w-[271px]"
        >
          <SheetTitle className="sr-only">Menú del punto de venta</SheetTitle>
          <div className="flex h-full flex-col">
            <ContenidoMenuPos
              empresa={empresa}
              terminales={terminales}
              terminal={terminal}
              turno={turno}
              usuario={usuario}
              expandido
              onNavegar={() => setMovilAbierto(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function ContenidoMenuPos({
  empresa,
  terminales,
  terminal,
  turno,
  usuario,
  expandido,
  fijado = false,
  mostrarPin = false,
  onAlternarFijado,
  onNavegar,
}: MenuPosProps & {
  expandido: boolean;
  fijado?: boolean;
  mostrarPin?: boolean;
  onAlternarFijado?: () => void;
  onNavegar?: () => void;
}) {
  const pathname = usePathname();
  const nombre = empresa.nombre?.trim() || "Punto de venta";

  return (
    <>
      <div
        className={cn(
          "border-sidebar-border flex h-14 shrink-0 items-center gap-2 border-b",
          expandido ? "px-3" : "justify-center px-0",
        )}
      >
        {empresa.logo_url ? (
          // biome-ignore lint/performance/noImgElement: logo configurable de la empresa
          <img src={empresa.logo_url} alt={nombre} className="size-8 shrink-0 rounded object-contain" />
        ) : (
          <Store className="text-primary size-6 shrink-0" aria-hidden="true" />
        )}
        <span className={cn("min-w-0 flex-1 truncate text-sm font-semibold", !expandido && "hidden")} title={nombre}>
          {nombre}
        </span>
        {mostrarPin && expandido ? (
          <Button
            variant="ghost"
            size="icon"
            className="dark:hover:text-sidebar-foreground size-10 shrink-0 rounded-lg text-slate-400 hover:bg-slate-200/45 hover:text-slate-900 dark:hover:bg-white/[0.06]"
            aria-label={fijado ? "Soltar el menú" : "Dejar el menú abierto"}
            aria-pressed={fijado}
            title={fijado ? "Soltar el menú" : "Dejar el menú abierto"}
            onClick={onAlternarFijado}
          >
            {fijado ? <PinOff className="size-5" aria-hidden="true" /> : <Pin className="size-5" aria-hidden="true" />}
          </Button>
        ) : null}
      </div>

      <nav aria-label="Secciones del punto de venta" className="min-h-0 flex-1 overflow-y-auto p-2">
        <ul className="flex flex-col gap-0.5">
          {ITEMS_PRINCIPALES.map((item) =>
            esSeccion(item) ? (
              <ItemSeccion key={item.id} item={item} expandido={expandido} onNavegar={onNavegar} />
            ) : (
              <ItemEnlace
                key={item.id}
                item={item}
                activo={esActivo(pathname, item.href)}
                expandido={expandido}
                onNavegar={onNavegar}
              />
            ),
          )}
        </ul>

        <div aria-hidden="true" className="my-2 flex h-4 items-center py-1">
          <div className="dark:bg-sidebar-border h-px w-full bg-slate-200" />
        </div>

        <ul className="flex flex-col gap-0.5">
          {ITEMS_CONTABILIDAD.map((item) => (
            <ItemEnlace key={item.id} item={item} activo={false} expandido={expandido} onNavegar={onNavegar} />
          ))}
        </ul>
      </nav>

      <div className="border-sidebar-border mt-auto flex shrink-0 flex-col gap-1 border-t p-2">
        <SelectorTerminal terminales={terminales} activa={terminal} colapsado={!expandido} />
        <EstadoTurnoPos turno={turno} colapsado={!expandido} onNavegar={onNavegar} />
        <UsuarioPos nombre={usuario.nombre} correo={usuario.correo} colapsado={!expandido} />
        <SalirPos colapsado={!expandido} />
      </div>
    </>
  );
}

function ItemEnlace({
  item,
  activo,
  expandido,
  onNavegar,
}: {
  item: ItemEnlacePOS;
  activo: boolean;
  expandido: boolean;
  onNavegar?: () => void;
}) {
  return (
    <li>
      <Link
        href={item.href}
        target={item.externo ? "_blank" : undefined}
        rel={item.externo ? "noreferrer" : undefined}
        aria-current={activo ? "page" : undefined}
        title={item.etiqueta}
        className={cn(itemMenuBase, activo && itemMenuActivo, !expandido && itemMenuColapsado)}
        onClick={onNavegar}
      >
        <IconoItem icono={item.icono} activo={activo} />
        <span className={cn("min-w-0 flex-1 truncate", !expandido && "hidden")}>{item.etiqueta}</span>
        {item.externo && expandido ? (
          <ArrowUpRight className="dark:text-sidebar-foreground/50 size-4 shrink-0 text-slate-400" aria-hidden="true" />
        ) : null}
      </Link>
    </li>
  );
}

/**
 * Sección del menú (Ingresos, Turnos): el título agrupa sus subitems, que
 * están siempre visibles al expandir el panel —sin flechitas ni acordeón—
 * y se ocultan en el riel de 52 px, donde solo cabe el icono.
 */
function ItemSeccion({
  item,
  expandido,
  onNavegar,
}: {
  item: ItemSeccionPOS;
  expandido: boolean;
  onNavegar?: () => void;
}) {
  const pathname = usePathname();

  return (
    <li>
      <div title={item.etiqueta} className={cn(itemMenuSeccion, !expandido && itemMenuColapsado)}>
        <IconoItem icono={item.icono} />
        <span className={cn("min-w-0 flex-1 truncate", !expandido && "hidden")}>{item.etiqueta}</span>
      </div>
      {expandido ? (
        <ul className="dark:border-sidebar-border my-2 ml-[17px] flex flex-col border-l border-slate-200 pl-[10px]">
          {item.sub.map((sub) => {
            const activo = esActivo(pathname, sub.href);
            return (
              <li key={sub.id} className="mb-1 last:mb-0">
                <Link
                  href={sub.href}
                  aria-current={activo ? "page" : undefined}
                  title={sub.etiqueta}
                  className={cn(itemMenuBase, "min-h-8", activo && itemMenuActivo)}
                  onClick={onNavegar}
                >
                  <IconoItem icono={sub.icono} activo={activo} />
                  <span className="min-w-0 flex-1 truncate">{sub.etiqueta}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </li>
  );
}
