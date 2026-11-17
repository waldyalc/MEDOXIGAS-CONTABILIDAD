import type { ReactNode } from "react";

import { cn } from "cn";

/**
 * Lista: 1289 px, el ancho de la tarjeta de Alegra (GUIA-TABLAS §2.1).
 * La definición vive en `listas/tabla-lista.tsx`, junto a TarjetaLista y BarraLista;
 * se reexporta para que las pantallas tengan un solo punto de entrada del marco de página.
 */
export { ContenedorLista } from "@/components/listas/tabla-lista";

interface ContenedorProps {
  children: ReactNode;
  className?: string;
}

/**
 * Formulario de documento (factura, pago, asiento, nota): 1040 px.
 * El ancho no se elige por pantalla: los formularios angostos (672, 768, 896) se ven
 * como ficha y pierden la rejilla de documento de Alegra.
 */
export function ContenedorFormulario({ children, className }: ContenedorProps) {
  return <div className={cn("mx-auto flex w-full max-w-[1040px] flex-col gap-6", className)}>{children}</div>;
}

/** Detalle de documento y ficha: 1040 px, como la vista de factura de Alegra (GUIA-VISTA). */
export function ContenedorDetalle({ children, className }: ContenedorProps) {
  return <div className={cn("mx-auto flex w-full max-w-[1040px] flex-col gap-4", className)}>{children}</div>;
}
