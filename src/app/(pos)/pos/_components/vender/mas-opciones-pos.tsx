"use client";

import { useEffect, useRef } from "react";

import Link from "next/link";

import { type LucideIcon, X } from "@/components/icons";
import { Button } from "@/components/ui/button";

/**
 * Una opción del panel «Más opciones». La cuadrícula se arma con este arreglo:
 * sumar una línea en `opcionesMas` (panel-factura.tsx) agrega un cuadro.
 */
export interface OpcionMasOpciones {
  id: string;
  etiqueta: string;
  Icono: LucideIcon;
  /** Acción directa; el panel se cierra antes de ejecutarla. */
  accion?: () => void;
  /** Ruta a la que navega cuando la opción es un enlace. */
  href?: string;
  deshabilitada?: boolean;
}

const CUADRO =
  "border-pos-linea text-pos-texto flex min-h-[116px] flex-col items-center justify-center gap-3 rounded-xl border bg-white px-2 py-4 text-center transition-colors outline-none select-none hover:border-pos-primario/50 hover:bg-pos-acento/40 focus-visible:border-pos-primario focus-visible:ring-pos-primario/40 focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-40 dark:bg-card";

/**
 * Panel grande de opciones de la venta: tapa todo el carrito (misma medida),
 * conserva la venta y se cierra con la X o con Esc.
 */
export function MasOpcionesPos({ opciones, onCerrar }: { opciones: OpcionMasOpciones[]; onCerrar: () => void }) {
  const cerrarRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cerrarRef.current?.focus();

    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key !== "Escape") return;
      evento.preventDefault();
      onCerrar();
    };

    document.addEventListener("keydown", alPresionar);
    return () => document.removeEventListener("keydown", alPresionar);
  }, [onCerrar]);

  return (
    <section
      id="mas-opciones-pos"
      aria-label="Más opciones"
      className="bg-pos-panel absolute inset-0 z-20 flex flex-col"
    >
      <header className="border-pos-linea dark:bg-card flex h-[60px] shrink-0 items-center justify-between border-b bg-white pr-1 pl-5">
        <h2 className="dark:text-pos-texto text-lg font-bold whitespace-nowrap text-[#334155]">Más opciones</h2>
        <Button
          ref={cerrarRef}
          variant="ghost"
          size="icon"
          className="hover:text-pos-texto size-10"
          title="Volver al carrito"
          aria-label="Volver al carrito"
          onClick={onCerrar}
        >
          <X className="size-5" aria-hidden="true" />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {opciones.map(({ id, etiqueta, Icono, accion, href, deshabilitada }) => {
            const contenido = (
              <>
                <span className="bg-pos-acento text-pos-acento-texto flex size-12 items-center justify-center rounded-full">
                  <Icono className="size-6" aria-hidden="true" />
                </span>
                <span className="text-sm leading-5 font-medium">{etiqueta}</span>
              </>
            );

            if (href) {
              return (
                <Link key={id} href={href} className={CUADRO}>
                  {contenido}
                </Link>
              );
            }

            return (
              <button
                key={id}
                type="button"
                disabled={deshabilitada}
                className={CUADRO}
                onClick={() => {
                  onCerrar();
                  accion?.();
                }}
              >
                {contenido}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
