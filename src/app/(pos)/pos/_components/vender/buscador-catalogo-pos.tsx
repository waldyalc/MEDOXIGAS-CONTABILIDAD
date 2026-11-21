"use client";

import { type RefObject, useEffect, useState } from "react";

import { Loader2, Search, X } from "@/components/icons";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";

const ESPERA_MS = 250;

export function BuscadorCatalogoPos({
  inputRef,
  cargando,
  resultados,
  resaltado,
  onBuscar,
  onEnter,
  onMover,
  onLimpiar,
  limpiarToken = 0,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  cargando: boolean;
  resultados: number;
  resaltado: number;
  onBuscar: (texto: string) => void;
  /** Devuelve true si el Enter se resolvió como código de barra. */
  onEnter: (texto: string) => boolean;
  onMover: (delta: number) => void;
  onLimpiar: () => void;
  limpiarToken?: number;
}) {
  const [texto, setTexto] = useState("");

  useEffect(() => {
    inputRef.current?.focus();
  }, [inputRef]);

  useEffect(() => {
    if (limpiarToken === 0) return;
    setTexto("");
  }, [limpiarToken]);

  useEffect(() => {
    const temporizador = setTimeout(() => {
      onBuscar(texto.trim().length >= 2 ? texto.trim() : "");
    }, ESPERA_MS);
    return () => clearTimeout(temporizador);
  }, [texto, onBuscar]);

  function limpiar() {
    setTexto("");
    onBuscar("");
    onLimpiar();
    inputRef.current?.focus();
  }

  return (
    <div className="relative min-w-[190px] flex-1">
      <InputGroup className="h-11">
        <InputGroupAddon>
          <Search aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          ref={inputRef}
          data-buscador-pos
          value={texto}
          aria-label="Buscar productos"
          placeholder="Buscar producto, referencia o código…"
          aria-busy={cargando}
          autoComplete="off"
          onChange={(evento) => setTexto(evento.target.value)}
          onKeyDown={(evento) => {
            if (evento.key === "Enter") {
              evento.preventDefault();
              if (onEnter(texto.trim())) {
                setTexto("");
                return;
              }
              if (resultados === 1) {
                setTexto("");
                return;
              }
            }
            if (evento.key === "ArrowDown") {
              evento.preventDefault();
              onMover(1);
            }
            if (evento.key === "ArrowUp") {
              evento.preventDefault();
              onMover(-1);
            }
            if (evento.key === "Escape") {
              evento.stopPropagation();
              if (texto !== "") limpiar();
            }
          }}
        />
        {cargando ? (
          <InputGroupAddon align="inline-end">
            <Loader2 className="animate-spin" aria-hidden="true" />
            <span className="sr-only">Buscando productos…</span>
          </InputGroupAddon>
        ) : null}
        {texto !== "" && !cargando ? (
          <InputGroupAddon align="inline-end">
            <InputGroupButton size="icon-xs" aria-label="Limpiar búsqueda" onClick={limpiar}>
              <X aria-hidden="true" />
            </InputGroupButton>
          </InputGroupAddon>
        ) : null}
        <InputGroupAddon align="inline-end">
          <Kbd>F2</Kbd>
        </InputGroupAddon>
      </InputGroup>

      {resultados > 1 && resaltado >= 0 ? (
        <p className="text-muted-foreground mt-1 text-xs">{resultados} resultados. Usa las flechas para elegir.</p>
      ) : null}
    </div>
  );
}
