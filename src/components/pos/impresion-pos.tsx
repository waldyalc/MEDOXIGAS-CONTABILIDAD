"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

import { createPortal } from "react-dom";

import { toast } from "@/components/ui/toast";

/**
 * Portal único de impresión del POS. Monta el papel dentro de
 * `[data-print-root][data-print-paper]`, ajusta el título del archivo y llama
 * `window.print()`. El CSS de impresión ya oculta el resto de la aplicación.
 */
export function ImpresionPos({
  titulo,
  ancho,
  children,
  onCerrar,
}: {
  /** Título del archivo: `factura-B0200000015`, `cotizacion-12`, etc. */
  titulo: string;
  /** Ancho del ticket térmico; se omite en Carta. */
  ancho?: 80 | 57;
  children: ReactNode;
  onCerrar: () => void;
}) {
  const [montado, setMontado] = useState(false);
  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;

  useEffect(() => {
    setMontado(true);
  }, []);

  useEffect(() => {
    if (!montado) return;

    const anterior = document.title;
    document.title = titulo;
    let cancelado = false;

    const frame = requestAnimationFrame(() => {
      if (cancelado) return;

      try {
        window.print();
      } catch {
        toast.add({
          type: "error",
          title: "No se pudo imprimir",
          description: "No se pudo imprimir. Inténtalo de nuevo.",
        });
        document.title = anterior;
        cerrar.current();
        return;
      }

      window.setTimeout(() => {
        if (cancelado) return;
        document.title = anterior;
        cerrar.current();
      }, 900);
    });

    return () => {
      cancelado = true;
      cancelAnimationFrame(frame);
      document.title = anterior;
    };
  }, [montado, titulo]);

  if (!montado) return null;

  return createPortal(
    <div data-print-root data-print-pos={ancho ? `ticket-${ancho}` : undefined}>
      <div data-print-paper>{children}</div>
    </div>,
    document.body,
  );
}
