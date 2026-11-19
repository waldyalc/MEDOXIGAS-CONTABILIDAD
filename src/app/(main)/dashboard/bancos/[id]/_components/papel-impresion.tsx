"use client";

import { type ReactNode, useEffect, useState } from "react";

import { createPortal } from "react-dom";

/**
 * Mueve el papel imprimible a `document.body` dentro de `data-print-root`:
 * en pantalla no se ve y en `window.print()` es lo único que sale (globals.css).
 * Mismo patrón que `estado-cuenta-impresion.tsx`.
 */
export function PapelImpresion({ children }: { children: ReactNode }) {
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
  }, []);

  if (!montado) return null;

  return createPortal(
    <div data-print-root>
      <div data-print-paper className="bg-white p-4 text-black">
        {children}
      </div>
    </div>,
    document.body,
  );
}
