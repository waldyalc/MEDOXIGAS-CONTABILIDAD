"use client";

import * as React from "react";

import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import type { Rol } from "@/lib/auth/rol";

import { VentanaBusqueda } from "../busqueda/ventana-busqueda";

function esMac(): boolean {
  return /mac|iphone|ipad|ipod/i.test(navigator.userAgent);
}

interface Props {
  rol: Rol | null;
}

/**
 * Disparador de la búsqueda global del topbar (§1.13): la barra de 36 px con
 * su `Kbd`, el botón de móvil y el atajo global ⌘K/Ctrl+K. Los recientes, las
 * categorías, los resultados, los estados y el teclado los maneja
 * `VentanaBusqueda`; aquí solo queda la apertura.
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
      <Button
        variant="ghost"
        size="icon"
        onClick={abrir}
        aria-label="Buscar en Medoxigas Contabilidad"
        className="md:hidden"
      >
        <Search />
      </Button>

      <button
        type="button"
        onClick={abrir}
        aria-label={`Buscar en Medoxigas Contabilidad (${atajo}K)`}
        className="border-input bg-background text-muted-foreground hover:border-ring/60 hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50 hidden h-9 w-full max-w-xl items-center gap-2 rounded-lg border px-3 text-sm transition-colors focus-visible:ring-3 focus-visible:outline-none md:flex"
      >
        <Search className="size-4 shrink-0" />
        <span className="flex-1 truncate text-left">Buscar…</span>
        <KbdGroup className="shrink-0">
          <Kbd>{atajo}</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </button>

      <VentanaBusqueda abierto={abierto} onCambiarApertura={setAbierto} rol={rol} />
    </>
  );
}
