"use client";

import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";

import { getLocalStorageValue, setLocalStorageValue } from "@/lib/local-storage.client";

export type WidgetId =
  | "cxc"
  | "cxp"
  | "impuestos"
  | "clientes"
  | "devoluciones"
  | "productos-vendidos"
  | "ventas"
  | "gastos"
  | "flujo"
  | "top-productos"
  | "top-clientes"
  | "bancos";

export interface DefinicionWidget {
  id: WidgetId;
  titulo: string;
}

/** Widgets del Inicio en su orden canónico; `bancos` es el opcional. */
export const WIDGETS_INICIO: readonly DefinicionWidget[] = [
  { id: "cxc", titulo: "Cuentas por cobrar" },
  { id: "cxp", titulo: "Cuentas por pagar" },
  { id: "impuestos", titulo: "Impuestos en venta" },
  { id: "clientes", titulo: "Clientes con ventas" },
  { id: "devoluciones", titulo: "Devoluciones de clientes" },
  { id: "productos-vendidos", titulo: "Productos vendidos" },
  { id: "ventas", titulo: "Total de ventas" },
  { id: "gastos", titulo: "Distribución de gastos" },
  { id: "flujo", titulo: "Flujo de transacciones" },
  { id: "top-productos", titulo: "Productos más vendidos" },
  { id: "top-clientes", titulo: "Mejores clientes" },
  { id: "bancos", titulo: "Bancos y cajas" },
];

const CLAVE_WIDGETS = "inicio.widgets.visibles";
const OPCIONALES: readonly WidgetId[] = ["bancos"];

const VISIBLES_DEFECTO: readonly WidgetId[] = WIDGETS_INICIO.filter((widget) => !OPCIONALES.includes(widget.id)).map(
  (widget) => widget.id,
);

interface ContextoWidgets {
  esVisible: (id: WidgetId) => boolean;
  ocultar: (id: WidgetId) => void;
  mostrar: (id: WidgetId) => void;
  /** Widgets agregables por el menú «Agregar gráfica» (los ocultos). */
  agregables: DefinicionWidget[];
}

const WidgetsContext = createContext<ContextoWidgets | null>(null);

function leerVisibles(): Set<WidgetId> {
  const crudo = getLocalStorageValue(CLAVE_WIDGETS);
  if (crudo == null) return new Set(VISIBLES_DEFECTO);

  try {
    const ids: unknown = JSON.parse(crudo);
    const validos = new Set(WIDGETS_INICIO.map((widget) => widget.id));
    if (!Array.isArray(ids)) return new Set(VISIBLES_DEFECTO);
    return new Set(ids.filter((id): id is WidgetId => typeof id === "string" && validos.has(id as WidgetId)));
  } catch {
    return new Set(VISIBLES_DEFECTO);
  }
}

/**
 * Visibilidad de los widgets del Inicio: el usuario quita tarjetas con el
 * menú de cada card y las vuelve a agregar desde «Agregar gráfica». Se
 * guarda en localStorage (preferencia de la máquina, como en Alegra).
 */
export function ProveedorWidgets({ children }: { children: ReactNode }) {
  const [visibles, setVisibles] = useState<Set<WidgetId>>(() => new Set(VISIBLES_DEFECTO));

  useEffect(() => {
    setVisibles(leerVisibles());
  }, []);

  const valor = useMemo<ContextoWidgets>(() => {
    const guardar = (nuevos: Set<WidgetId>) => {
      setVisibles(nuevos);
      setLocalStorageValue(CLAVE_WIDGETS, JSON.stringify([...nuevos]));
    };

    return {
      esVisible: (id) => visibles.has(id),
      ocultar: (id) => {
        const nuevos = new Set(visibles);
        nuevos.delete(id);
        guardar(nuevos);
      },
      mostrar: (id) => {
        const nuevos = new Set(visibles);
        nuevos.add(id);
        guardar(nuevos);
      },
      agregables: WIDGETS_INICIO.filter((widget) => !visibles.has(widget.id)),
    };
  }, [visibles]);

  return <WidgetsContext.Provider value={valor}>{children}</WidgetsContext.Provider>;
}

export function useWidgetsInicio(): ContextoWidgets {
  const contexto = useContext(WidgetsContext);
  if (contexto == null) throw new Error("useWidgetsInicio debe usarse dentro de <ProveedorWidgets>");
  return contexto;
}
