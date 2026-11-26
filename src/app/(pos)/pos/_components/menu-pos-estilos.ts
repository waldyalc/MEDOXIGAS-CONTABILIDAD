import { cn } from "cn";

/**
 * Ítem del menú del POS: 32 px de alto, radio 6 px, texto 14/21 px, icono 20 px
 * gris y, cuando está activo, fondo de acento + barra primaria de 3×16 px a la
 * izquierda (medidas de `docs/alegra/css-menu/GUIA-MENU.md`, con tokens del POS).
 */
export const itemMenuBase =
  "relative flex h-8 w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-sm leading-[21px] font-normal " +
  "text-slate-700 dark:text-sidebar-foreground/85 " +
  "before:absolute before:top-1/2 before:left-0 before:h-4 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-pos-primario before:opacity-0 before:content-[''] " +
  "hover:bg-slate-200/45 hover:text-slate-900 active:bg-slate-200/70 " +
  "dark:hover:bg-white/[0.06] dark:hover:text-sidebar-foreground dark:active:bg-white/[0.09] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1";

export const itemMenuActivo =
  "bg-sidebar-accent text-slate-900 before:opacity-100 " +
  "hover:bg-sidebar-accent hover:text-slate-900 active:bg-sidebar-accent " +
  "dark:bg-white/[0.09] dark:text-sidebar-foreground dark:hover:bg-white/[0.09] dark:active:bg-white/[0.12]";

export function claseIconoMenu(activo: boolean): string {
  return cn(
    "size-5 shrink-0 stroke-[1.6]",
    activo ? "dark:text-sidebar-foreground text-slate-900" : "dark:text-sidebar-foreground/50 text-slate-400",
  );
}

/** Versión del ítem colapsada al riel de 52 px: solo el icono, centrado. */
export const itemMenuColapsado = "justify-center px-0";
