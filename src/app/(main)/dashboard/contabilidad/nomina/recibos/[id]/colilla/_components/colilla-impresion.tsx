"use client";

import { type ReactNode, useEffect, useState } from "react";

import { createPortal } from "react-dom";

/** Monta el papel en `data-print-root` para que la impresión muestre solo la colilla. */
export function ColillaImpresion({ children }: { children: ReactNode }) {
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
  }, []);

  if (!montado) return null;

  return createPortal(
    <div data-print-root>
      <div data-print-paper>{children}</div>
    </div>,
    document.body,
  );
}
