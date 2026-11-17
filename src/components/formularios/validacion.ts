"use client";

import { useCallback, useState } from "react";

import { toast } from "@/components/ui/toast";
import { erroresDe, mapaErrores, type ReglaCampo } from "@/lib/formularios/validacion";

export const TOAST_CAMPOS_OBLIGATORIOS = {
  title: "Revise los campos obligatorios",
  description: "Asegúrese de completar todos los campos marcados en rojo.",
} as const;

/**
 * Lleva al usuario al campo inválido: lo desplaza al centro y le da el foco.
 * El id tiene que estar en el control (Input, Trigger del Select o input del Combobox).
 */
export function enfocarCampo(campo: string) {
  if (typeof document === "undefined") return;

  requestAnimationFrame(() => {
    const elemento = document.getElementById(campo);
    if (!elemento) return;

    elemento.scrollIntoView({ behavior: "smooth", block: "center" });
    elemento.focus({ preventScroll: true });
  });
}

/**
 * Errores de campo de un formulario. `validar` pinta los mensajes, muestra el
 * toast de campos obligatorios y enfoca el primer campo inválido; devuelve
 * `false` cuando hay algo que corregir (para cortar el guardado).
 */
export function useValidacionFormulario() {
  const [errores, setErrores] = useState<Record<string, string>>({});

  const errorDe = (campo: string) => errores[campo];

  const limpiar = useCallback(
    (campo: string) =>
      setErrores((previos) => {
        if (!(campo in previos)) return previos;
        const resto = { ...previos };
        delete resto[campo];
        return resto;
      }),
    [],
  );

  const limpiarTodo = useCallback(() => setErrores({}), []);

  const validar = useCallback((reglas: ReglaCampo[]) => {
    const lista = erroresDe(reglas);
    setErrores(mapaErrores(lista));

    if (lista.length === 0) return true;

    toast.add({ type: "error", ...TOAST_CAMPOS_OBLIGATORIOS });
    const primero = lista[0];
    if (primero) enfocarCampo(primero.campo);
    return false;
  }, []);

  return { errores, errorDe, limpiar, limpiarTodo, validar };
}
