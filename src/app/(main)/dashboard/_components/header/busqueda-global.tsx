"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import type { LucideIcon } from "lucide-react";
import { Clock, FileText, Package, Search, TrendingUp, Users } from "lucide-react";

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
import { buscarEntidades, type ResultadoBusquedaGlobal } from "@/lib/busqueda/acciones";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";
import { getLocalStorageValue, setLocalStorageValue } from "@/lib/local-storage.client";
import { REPORTES } from "@/lib/reportes/catalogo-reportes";
import { filtrarItemsPorRol } from "@/navigation/sidebar/sidebar-items";

const CLAVE_RECIENTES = "medoxigas.busqueda.recientes";
const MAX_RECIENTES = 5;

/** Espera antes de consultar la base mientras se escribe (ms). */
const ESPERA_BUSQUEDA_MS = 300;

/** Mínimo de caracteres para buscar datos (igual que la server action). */
const MINIMO_BUSQUEDA = 2;

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
  const [datos, setDatos] = React.useState<ResultadoBusquedaGlobal | null>(null);
  const [atajo, setAtajo] = React.useState("Ctrl");
  const solicitudDatos = React.useRef(0);

  const enlaces = React.useMemo(() => enlacesDeNavegacion(rol), [rol]);
  const buscando = texto.trim().length > 0;

  React.useEffect(() => {
    if (esMac()) setAtajo("⌘");
  }, []);

  // Busca contactos, productos y facturas en la base con debounce; si falla,
  // los datos se descartan y la paleta queda solo con navegación y reportes.
  React.useEffect(() => {
    const termino = texto.trim();

    if (!abierto || termino.length < MINIMO_BUSQUEDA) {
      solicitudDatos.current += 1;
      setDatos(null);
      return;
    }

    const numero = solicitudDatos.current + 1;
    solicitudDatos.current = numero;

    const temporizador = setTimeout(() => {
      buscarEntidades(termino)
        .then((resultado) => {
          if (solicitudDatos.current === numero) setDatos(resultado);
        })
        .catch(() => {
          if (solicitudDatos.current === numero) setDatos(null);
        });
    }, ESPERA_BUSQUEDA_MS);

    return () => clearTimeout(temporizador);
  }, [abierto, texto]);

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
        description="Buscar contactos, productos y facturas, o ir a módulos y reportes."
        className="gap-0 sm:max-w-lg"
      >
        <Command>
          <CommandInput
            autoFocus
            placeholder="Buscar contactos, productos, facturas…"
            aria-label="Buscar contactos, productos, facturas, módulos y reportes"
            value={texto}
            onValueChange={setTexto}
          />
          <CommandList>
            <CommandEmpty>
              {buscando ? `Sin resultados para «${texto.trim()}».` : "No hay páginas para mostrar."}
            </CommandEmpty>

            {datos && datos.contactos.length > 0 ? (
              <CommandGroup heading="Contactos">
                {datos.contactos.map((contacto) => (
                  <CommandItem
                    key={`contacto-${contacto.id}`}
                    value={["contacto", contacto.nombre, contacto.rnc].filter(Boolean).join(" ")}
                    onSelect={() => ir(`/dashboard/contactos/${contacto.id}`, contacto.nombre)}
                  >
                    <Users />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{contacto.nombre}</span>
                      {contacto.rnc ? (
                        <span className="text-muted-foreground truncate text-xs tabular-nums">{contacto.rnc}</span>
                      ) : null}
                    </span>
                    <span className="text-muted-foreground ml-auto shrink-0 text-xs">{contacto.tipo}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {datos && datos.productos.length > 0 ? (
              <CommandGroup heading="Productos">
                {datos.productos.map((producto) => (
                  <CommandItem
                    key={`producto-${producto.id}`}
                    value={["producto", producto.nombre, producto.referencia].filter(Boolean).join(" ")}
                    onSelect={() => ir(`/dashboard/productos/${producto.id}`, producto.nombre)}
                  >
                    <Package />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{producto.nombre}</span>
                      <span className="text-muted-foreground truncate text-xs tabular-nums">
                        {[producto.referencia, formatoMoneda(producto.precio)].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {datos && datos.facturas.length > 0 ? (
              <CommandGroup heading="Facturas">
                {datos.facturas.map((factura) => (
                  <CommandItem
                    key={`factura-${factura.id}`}
                    value={["factura", factura.ncf, factura.contacto].filter(Boolean).join(" ")}
                    onSelect={() => ir(`/dashboard/facturacion/${factura.id}`, factura.ncf)}
                  >
                    <FileText />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-mono">{factura.ncf}</span>
                      <span className="text-muted-foreground truncate text-xs">
                        {[factura.contacto, formatoDia(factura.fecha)].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="text-muted-foreground ml-auto shrink-0 text-xs tabular-nums">
                      {formatoMoneda(factura.total)}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

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
