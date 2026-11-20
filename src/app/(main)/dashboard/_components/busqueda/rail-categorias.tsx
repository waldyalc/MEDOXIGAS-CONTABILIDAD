"use client";

import { cn } from "cn";
import type { LucideIcon } from "lucide-react";
import { Clock, FileText, MoreHorizontal, Package, ReceiptText, ShoppingCart, Users } from "lucide-react";

import type { GrupoBusqueda } from "./agrupar";

/**
 * Categorías del rail: los grupos del buscador + Recientes (localStorage, §1.4).
 * «Documentos» sigue en el tipo porque `agrupar` puede devolver ese grupo, pero
 * no se ofrece en el rail hasta que exista la fase 4.
 */
export type CategoriaRail = "recientes" | GrupoBusqueda;

export const NOMBRE_CATEGORIAS: Record<CategoriaRail, string> = {
  recientes: "Recientes",
  clientes: "Clientes",
  productos: "Productos",
  facturacion: "Facturación",
  compras: "Compras",
  documentos: "Documentos",
  otros: "Otros",
};

export const ICONO_CATEGORIA: Record<CategoriaRail, LucideIcon> = {
  recientes: Clock,
  clientes: Users,
  productos: Package,
  facturacion: ReceiptText,
  compras: ShoppingCart,
  documentos: FileText,
  otros: MoreHorizontal,
};

const ORDEN_CATEGORIAS: CategoriaRail[] = ["recientes", "clientes", "productos", "facturacion", "compras", "otros"];

interface Props {
  /** Conteo por categoría: los totales reales de `agrupar` + los recientes. */
  conteos: Partial<Record<CategoriaRail, number>>;
  /** null = sin filtro: se muestran todos los grupos (§1.4). */
  activa: CategoriaRail | null;
  onElegir: (categoria: CategoriaRail) => void;
  /** "rail" = escritorio/compacta (190/168 px); "chips" = móvil (§1.11). */
  variante?: "rail" | "chips";
  /** true → rail de 168 px (viewport < 1024 o alto < 780, §1.1). */
  compacta?: boolean;
  className?: string;
}

/**
 * Rail izquierdo de categorías (§1.4): icono, nombre y conteo por categoría.
 * Son filtros con `aria-pressed`, no pestañas.
 */
export function RailCategorias({ conteos, activa, onElegir, variante = "rail", compacta = false, className }: Props) {
  if (variante === "chips") {
    return (
      <nav aria-label="Categorías de búsqueda" className={cn("border-border border-b dark:border-white/10", className)}>
        <ul className="flex [scrollbar-width:none] gap-3 overflow-x-auto px-4 py-2 [&::-webkit-scrollbar]:hidden">
          {ORDEN_CATEGORIAS.map((categoria) => (
            <li key={categoria} className="shrink-0">
              <ItemCategoria
                categoria={categoria}
                conteo={conteos[categoria] ?? 0}
                activa={activa === categoria}
                onElegir={onElegir}
                chips
              />
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  return (
    <nav
      aria-label="Categorías de búsqueda"
      className={cn(
        "bg-muted/30 border-border shrink-0 border-r p-2 dark:border-white/20 dark:bg-black/20",
        compacta ? "w-[168px]" : "w-[190px]",
        className,
      )}
    >
      <ul className="flex flex-col gap-0.5">
        {ORDEN_CATEGORIAS.map((categoria) => (
          <li key={categoria}>
            <ItemCategoria
              categoria={categoria}
              conteo={conteos[categoria] ?? 0}
              activa={activa === categoria}
              onElegir={onElegir}
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function ItemCategoria({
  categoria,
  conteo,
  activa,
  onElegir,
  chips = false,
}: {
  categoria: CategoriaRail;
  conteo: number;
  activa: boolean;
  onElegir: (categoria: CategoriaRail) => void;
  chips?: boolean;
}) {
  const Icono = ICONO_CATEGORIA[categoria];

  return (
    <button
      type="button"
      aria-pressed={activa}
      onClick={() => onElegir(categoria)}
      className={cn(
        "flex h-9 items-center gap-2 rounded-lg text-left",
        chips ? "bg-muted/60 shrink-0 rounded-full px-3" : "hover:bg-muted w-full px-2",
        activa && "bg-secondary text-secondary-foreground dark:bg-secondary/25",
      )}
    >
      <Icono className="size-4 shrink-0" />
      <span className="truncate text-[13px] font-medium">{NOMBRE_CATEGORIAS[categoria]}</span>
      <span
        className={cn("text-muted-foreground ml-auto shrink-0 text-[11px] tabular-nums", conteo === 0 && "opacity-50")}
      >
        {conteo}
      </span>
    </button>
  );
}
