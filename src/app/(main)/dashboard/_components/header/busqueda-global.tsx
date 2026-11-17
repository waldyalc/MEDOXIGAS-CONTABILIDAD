"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import type { LucideIcon } from "lucide-react";
import { Clock, Search, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import type { Rol } from "@/lib/auth/rol";
import { getLocalStorageValue, setLocalStorageValue } from "@/lib/local-storage.client";
import { REPORTES } from "@/lib/reportes/catalogo-reportes";
import { filtrarItemsPorRol } from "@/navigation/sidebar/sidebar-items";

const CLAVE_RECIENTES = "medoxigas.busqueda.recientes";
const MAX_RECIENTES = 5;

interface Enlace {
  id: string;
  titulo: string;
  url: string;
  /** Módulo del menú al que pertenece el enlace (solo subítems). */
  modulo?: string;
  icono: LucideIcon;
}

interface Reciente {
  titulo: string;
  url: string;
}

/** Enlaces de navegación del menú lateral, aplanados a una sola lista. */
function enlacesDeNavegacion(rol: Rol | null): Enlace[] {
  const enlaces: Enlace[] = [];

  for (const grupo of filtrarItemsPorRol(rol)) {
    for (const item of grupo.items) {
      if (item.subItems == null) {
        enlaces.push({ id: item.id, titulo: item.title, url: item.url, icono: item.icon ?? Search });
        continue;
      }

      for (const subItem of item.subItems) {
        if (subItem.disabled) continue;
        enlaces.push({
          id: subItem.id,
          titulo: subItem.title,
          url: subItem.url,
          modulo: item.title,
          icono: item.icon ?? Search,
        });
      }
    }
  }

  return enlaces;
}

// TODO backend: cuando exista la búsqueda de contactos, productos y facturas,
// agregar esos grupos aquí (consultando una ruta api/ o server action).
const ENLACES_REPORTES: Enlace[] = REPORTES.flatMap((reporte) =>
  reporte.href == null
    ? []
    : [
        {
          id: `reporte-${reporte.href}`,
          titulo: reporte.nombre,
          url: reporte.href,
          icono: TrendingUp,
        },
      ],
);

function leerRecientes(): Reciente[] {
  const crudo = getLocalStorageValue(CLAVE_RECIENTES);
  if (crudo == null) return [];

  try {
    const datos: unknown = JSON.parse(crudo);
    if (!Array.isArray(datos)) return [];

    return datos
      .flatMap((valor): Reciente[] => {
        if (typeof valor !== "object" || valor == null) return [];
        const { titulo, url } = valor as { titulo?: unknown; url?: unknown };
        if (typeof titulo !== "string" || typeof url !== "string") return [];
        return [{ titulo, url }];
      })
      .slice(0, MAX_RECIENTES);
  } catch {
    return [];
  }
}

function guardarReciente(reciente: Reciente) {
  const anteriores = leerRecientes().filter((item) => item.url !== reciente.url);
  setLocalStorageValue(CLAVE_RECIENTES, JSON.stringify([reciente, ...anteriores].slice(0, MAX_RECIENTES)));
}

function esMac(): boolean {
  return /mac|iphone|ipad|ipod/i.test(navigator.userAgent);
}

interface Props {
  rol: Rol | null;
}

export function BusquedaGlobal({ rol }: Props) {
  const router = useRouter();
  const [abierto, setAbierto] = React.useState(false);
  const [texto, setTexto] = React.useState("");
  const [recientes, setRecientes] = React.useState<Reciente[]>([]);
  const [atajo, setAtajo] = React.useState("Ctrl");

  const enlaces = React.useMemo(() => enlacesDeNavegacion(rol), [rol]);
  const buscando = texto.trim().length > 0;

  React.useEffect(() => {
    if (esMac()) setAtajo("⌘");
  }, []);

  const abrirDialogo = React.useCallback(() => {
    setRecientes(leerRecientes());
    setTexto("");
    setAbierto(true);
  }, []);

  // Atajo global: ⌘K en Mac, Ctrl+K en Windows/Linux.
  React.useEffect(() => {
    function alPresionarTecla(evento: KeyboardEvent) {
      if (evento.key.toLowerCase() !== "k" || !(evento.metaKey || evento.ctrlKey) || evento.altKey) return;

      evento.preventDefault();
      abrirDialogo();
    }

    document.addEventListener("keydown", alPresionarTecla);
    return () => document.removeEventListener("keydown", alPresionarTecla);
  }, [abrirDialogo]);

  function cambiarApertura(siguiente: boolean) {
    setAbierto(siguiente);
    if (!siguiente) setTexto("");
  }

  function ir(url: string, titulo: string) {
    guardarReciente({ titulo, url });
    setAbierto(false);
    setTexto("");
    router.push(url);
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={abrirDialogo}
        aria-label="Buscar en Medoxigas Contabilidad"
        className="md:hidden"
      >
        <Search />
      </Button>

      <button
        type="button"
        onClick={abrirDialogo}
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

      <CommandDialog
        open={abierto}
        onOpenChange={cambiarApertura}
        title="Buscar en Medoxigas Contabilidad"
        description="Ir a módulos, reportes y páginas recientes."
        className="gap-0 sm:max-w-lg"
      >
        <Command>
          <CommandInput
            autoFocus
            placeholder="Buscar módulos y reportes…"
            aria-label="Buscar módulos y reportes"
            value={texto}
            onValueChange={setTexto}
          />
          <CommandList>
            <CommandEmpty>
              {buscando ? `Sin resultados para «${texto.trim()}».` : "No hay páginas para mostrar."}
            </CommandEmpty>

            {!buscando && recientes.length > 0 ? (
              <CommandGroup heading="Recientes">
                {recientes.map((reciente) => (
                  <CommandItem
                    key={`reciente-${reciente.url}`}
                    value={`reciente ${reciente.titulo}`}
                    onSelect={() => ir(reciente.url, reciente.titulo)}
                  >
                    <Clock />
                    <span className="truncate">{reciente.titulo}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {enlaces.length > 0 ? (
              <CommandGroup heading="Ir a">
                {enlaces.map((enlace) => (
                  <CommandItem
                    key={enlace.id}
                    value={`${enlace.modulo ?? ""} ${enlace.titulo}`}
                    onSelect={() => ir(enlace.url, enlace.titulo)}
                  >
                    <enlace.icono />
                    <span className="truncate">{enlace.titulo}</span>
                    {enlace.modulo ? (
                      <span className="text-muted-foreground ml-auto truncate text-xs">{enlace.modulo}</span>
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {buscando ? (
              <CommandGroup heading="Reportes">
                {ENLACES_REPORTES.map((enlace) => (
                  <CommandItem
                    key={enlace.id}
                    value={`reporte ${enlace.titulo}`}
                    onSelect={() => ir(enlace.url, enlace.titulo)}
                  >
                    <enlace.icono />
                    <span className="truncate">{enlace.titulo}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>

        <div className="text-muted-foreground flex items-center gap-3 border-t px-3 py-2 text-xs">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            Navegar
          </span>
          <span className="flex items-center gap-1">
            <Kbd>↵</Kbd>
            Abrir
          </span>
          <span className="ml-auto flex items-center gap-1">
            <Kbd>Esc</Kbd>
            Cerrar
          </span>
        </div>
      </CommandDialog>
    </>
  );
}
