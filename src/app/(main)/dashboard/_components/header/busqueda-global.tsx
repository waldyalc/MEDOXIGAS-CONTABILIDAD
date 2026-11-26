"use client";

import * as React from "react";

import { Search } from "@/components/icons";
import type { Rol } from "@/lib/auth/rol";

import { VentanaBusqueda } from "../busqueda/ventana-busqueda";

function esMac(): boolean {
  return /mac|iphone|ipad|ipod/i.test(navigator.userAgent);
}

interface Props {
  rol: Rol | null;
}

/**
 * Disparador de la búsqueda global del topbar — copia exacta de Alegra
 * (`max-w-[475px]`, `h-8` / 32 px, fondo blanco, borde `slate-200`, hover
 * `slate-400` sin azul, lupa 16 px y texto «Buscar» sin badges `Ctrl K`).
 * El atajo global ⌘K / Ctrl+K sigue activo en teclado.
 */
export function BusquedaGlobal({ rol }: Props) {
  const [abierto, setAbierto] = React.useState(false);
  const [atajo, setAtajo] = React.useState("Ctrl");

  React.useEffect(() => {
    if (esMac()) setAtajo("⌘");
  }, []);

  // Atajo global (§1.13): ⌘K en Mac y Ctrl+K en Windows/Linux, ignorando Alt
  // y atajos que otro componente ya reclamó. Hace toggle: abre y también cierra.
  React.useEffect(() => {
    function alPresionarTecla(evento: KeyboardEvent) {
      if (evento.defaultPrevented) return;
      if (evento.key.toLowerCase() !== "k" || !(evento.metaKey || evento.ctrlKey) || evento.altKey) return;

      evento.preventDefault();
      setAbierto((anterior) => !anterior);
    }

    document.addEventListener("keydown", alPresionarTecla);
    return () => document.removeEventListener("keydown", alPresionarTecla);
  }, []);

  function abrir() {
    setAbierto(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-label="Abrir búsqueda"
        className="flex size-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-none md:hidden dark:text-slate-400 dark:hover:bg-white/[0.06]"
      >
        <Search className="size-5 stroke-[1.5]" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={abrir}
        aria-label={`Buscar (${atajo}K)`}
        className="dark:border-border dark:bg-background/60 dark:text-muted-foreground dark:hover:border-muted-foreground/50 dark:focus-visible:border-muted-foreground/50 hidden h-8 w-full max-w-[475px] cursor-pointer items-center gap-2 rounded-[8px] border border-slate-200 bg-white pr-1 pl-2 text-sm font-normal text-slate-400 transition-colors hover:border-slate-400 focus-visible:border-slate-400 focus-visible:outline-none md:flex"
      >
        <Search className="dark:text-muted-foreground size-4 shrink-0 stroke-[1.5] text-slate-400" aria-hidden="true" />
        <span className="flex-1 truncate text-left">Buscar</span>
      </button>

      <VentanaBusqueda abierto={abierto} onCambiarApertura={setAbierto} rol={rol} />
    </>
  );
}
