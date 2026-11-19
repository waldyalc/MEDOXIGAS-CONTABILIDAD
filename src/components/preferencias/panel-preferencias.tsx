"use client";

import { type ReactNode, useEffect, useRef } from "react";

import { usePathname } from "next/navigation";

import { Monitor, Moon, RotateCcw, Sun } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { type FontKey, fontKeys, fontOptions } from "@/lib/fonts/registry";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";

const TEMAS = [
  { value: "light", label: "Claro", icono: Sun },
  { value: "dark", label: "Oscuro", icono: Moon },
  { value: "system", label: "Sistema", icono: Monitor },
] as const;

const CONTENIDOS = [
  { value: "centered", label: "Centrado" },
  { value: "full-width", label: "Ancho completo" },
] as const;

const BARRAS = [
  { value: "sticky", label: "Fija" },
  { value: "scroll", label: "Desplazable" },
] as const;

const VARIANTES_MENU = [
  { value: "sidebar", label: "Normal" },
  { value: "inset", label: "Insertado" },
  { value: "floating", label: "Flotante" },
] as const;

const COLAPSOS_MENU = [
  { value: "icon", label: "Íconos" },
  { value: "offcanvas", label: "Deslizable" },
] as const;

const FUENTES = fontOptions.map((fuente) => ({ value: fuente.key, label: fuente.label }));

function esFuente(valor: string): valor is FontKey {
  return fontKeys.some((clave) => clave === valor);
}

function Seccion({ titulo, descripcion, children }: { titulo: string; descripcion: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-foreground text-sm font-medium">{titulo}</h3>
        <p className="text-muted-foreground text-xs">{descripcion}</p>
      </div>
      {children}
    </section>
  );
}

interface PanelPreferenciasProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Panel de preferencias de la plantilla: tema, fuente, contenido y menú lateral. */
export function PanelPreferencias({ open, onOpenChange }: PanelPreferenciasProps) {
  const ruta = usePathname();
  const rutaAnterior = useRef(ruta);
  const { valores, setPreference, resetPreferences } = usePreferencesStore(
    useShallow((state) => ({
      valores: state.values,
      setPreference: state.setPreference,
      resetPreferences: state.resetPreferences,
    })),
  );

  // El panel no es una ruta: si el usuario navega con él abierto, se cierra.
  useEffect(() => {
    if (rutaAnterior.current === ruta) return;
    rutaAnterior.current = ruta;
    onOpenChange(false);
  }, [ruta, onOpenChange]);

  function cambiarTema(siguientes: string[]) {
    const tema = TEMAS.find((opcion) => opcion.value === siguientes[0]);
    if (tema) setPreference("theme_mode", tema.value);
  }

  function cambiarContenido(siguientes: string[]) {
    const opcion = CONTENIDOS.find((contenido) => contenido.value === siguientes[0]);
    if (opcion) setPreference("content_layout", opcion.value);
  }

  function cambiarBarra(siguientes: string[]) {
    const opcion = BARRAS.find((barra) => barra.value === siguientes[0]);
    if (opcion) setPreference("navbar_style", opcion.value);
  }

  function cambiarVariante(siguientes: string[]) {
    const opcion = VARIANTES_MENU.find((variante) => variante.value === siguientes[0]);
    if (opcion) setPreference("sidebar_variant", opcion.value);
  }

  function cambiarColapso(siguientes: string[]) {
    const opcion = COLAPSOS_MENU.find((colapso) => colapso.value === siguientes[0]);
    if (opcion) setPreference("sidebar_collapsible", opcion.value);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-[380px]">
        <SheetHeader className="border-border border-b">
          <SheetTitle>Preferencias</SheetTitle>
          <SheetDescription>Elige cómo se ve Medoxigas Contabilidad. Se guarda en este navegador.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-4">
          <Seccion titulo="Tema" descripcion="Claro, oscuro o el que use tu sistema.">
            <ToggleGroup
              aria-label="Tema"
              value={[valores.theme_mode]}
              onValueChange={cambiarTema}
              variant="outline"
              spacing={0}
              className="w-full"
            >
              {TEMAS.map((tema) => {
                const Icono = tema.icono;
                return (
                  <ToggleGroupItem key={tema.value} value={tema.value} className="h-auto flex-1 flex-col gap-1 py-2">
                    <Icono className="size-4" />
                    <span className="text-xs font-normal">{tema.label}</span>
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          </Seccion>

          <Seccion titulo="Fuente" descripcion="Tipografía de toda la aplicación.">
            <Select
              items={FUENTES}
              value={valores.font}
              onValueChange={(valor: string | null) => {
                if (valor && esFuente(valor)) setPreference("font", valor);
              }}
            >
              <SelectTrigger id="preferencia-fuente" aria-label="Fuente" className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FUENTES.map((fuente) => (
                  <SelectItem key={fuente.value} value={fuente.value}>
                    {fuente.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Seccion>

          <Seccion titulo="Contenido" descripcion="Ancho de las páginas del sistema.">
            <ToggleGroup
              aria-label="Contenido"
              value={[valores.content_layout]}
              onValueChange={cambiarContenido}
              spacing={0}
              className="w-full"
            >
              {CONTENIDOS.map((contenido) => (
                <ToggleGroupItem key={contenido.value} value={contenido.value} className="flex-1 text-xs">
                  {contenido.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Seccion>

          <Seccion titulo="Barra superior" descripcion="Si se queda fija al desplazarte.">
            <ToggleGroup
              aria-label="Barra superior"
              value={[valores.navbar_style]}
              onValueChange={cambiarBarra}
              spacing={0}
              className="w-full"
            >
              {BARRAS.map((barra) => (
                <ToggleGroupItem key={barra.value} value={barra.value} className="flex-1 text-xs">
                  {barra.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Seccion>

          <Seccion titulo="Menú lateral" descripcion="Cómo se muestra el menú de módulos.">
            <ToggleGroup
              aria-label="Menú lateral"
              value={[valores.sidebar_variant]}
              onValueChange={cambiarVariante}
              spacing={0}
              className="w-full"
            >
              {VARIANTES_MENU.map((variante) => (
                <ToggleGroupItem key={variante.value} value={variante.value} className="flex-1 text-xs">
                  {variante.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Seccion>

          <Seccion titulo="Menú contraído" descripcion="Cómo se reduce el menú lateral.">
            <ToggleGroup
              aria-label="Menú contraído"
              value={[valores.sidebar_collapsible]}
              onValueChange={cambiarColapso}
              spacing={0}
              className="w-full"
            >
              {COLAPSOS_MENU.map((colapso) => (
                <ToggleGroupItem key={colapso.value} value={colapso.value} className="flex-1 text-xs">
                  {colapso.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Seccion>
        </div>

        <SheetFooter className="border-border border-t">
          <Button type="button" variant="outline" className="w-full" onClick={resetPreferences}>
            <RotateCcw className="size-4" />
            Restablecer preferencias
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
