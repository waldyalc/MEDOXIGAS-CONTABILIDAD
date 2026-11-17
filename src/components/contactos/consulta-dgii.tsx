"use client";

import { useCallback, useRef, useState } from "react";

import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buscarContribuyenteDgii } from "@/lib/dgii/acciones";
import type { DatosContribuyenteDgii, TipoDocumentoDgii } from "@/lib/dgii/consulta";

export interface MensajeDgii {
  tono: "ok" | "error";
  texto: string;
}

/**
 * Pide al servidor la consulta de la DGII y entrega los datos al formulario.
 * El formulario decide qué campos completar; aquí no se guarda nada.
 */
export function useConsultaDgii() {
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<MensajeDgii | null>(null);
  const solicitud = useRef(0);

  const consultar = useCallback(
    async (numero: string, tipo: TipoDocumentoDgii, completar: (datos: DatosContribuyenteDgii) => string) => {
      const actual = solicitud.current + 1;
      solicitud.current = actual;
      setCargando(true);
      setMensaje(null);

      try {
        const resultado = await buscarContribuyenteDgii(numero, tipo);
        if (solicitud.current !== actual) return;

        if (!resultado.ok) {
          setMensaje({ tono: "error", texto: resultado.error });
          return;
        }

        setMensaje({ tono: "ok", texto: completar(resultado.datos) });
      } catch {
        if (solicitud.current === actual) {
          setMensaje({
            tono: "error",
            texto: "No se pudo consultar la DGII. Intenta de nuevo o escríbelo a mano.",
          });
        }
      } finally {
        if (solicitud.current === actual) setCargando(false);
      }
    },
    [],
  );

  const limpiar = useCallback(() => {
    solicitud.current += 1;
    setCargando(false);
    setMensaje(null);
  }, []);

  return { cargando, mensaje, consultar, limpiar };
}

export function BotonAutocompletarDgii({
  onClick,
  cargando,
  disabled = false,
}: {
  readonly onClick: () => void;
  readonly cargando: boolean;
  readonly disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={disabled ? true : cargando}
      aria-label="Autocompletar con la DGII"
      className="h-9 w-fit gap-2 rounded-[10px] px-3 text-sm"
    >
      {cargando ? <Loader2 className="animate-spin" /> : <Sparkles />}
      {cargando ? "Autocompletando…" : "Autocompletar"}
    </Button>
  );
}

export function MensajeDgii({ mensaje }: { readonly mensaje: MensajeDgii | null }) {
  if (mensaje === null) return null;
  return (
    <p
      role={mensaje.tono === "error" ? "alert" : "status"}
      className={
        mensaje.tono === "error" ? "text-destructive text-xs" : "text-xs text-emerald-600 dark:text-emerald-400"
      }
    >
      {mensaje.texto}
    </p>
  );
}

/** RNC cuando hay 9 dígitos, cédula cuando hay 11; null si no aplica. */
export function tipoDocumentoDesde(numero: string): TipoDocumentoDgii | null {
  const digitos = numero.replace(/\D/g, "");
  if (digitos.length === 9) return "rnc";
  if (digitos.length === 11) return "cedula";
  return null;
}
