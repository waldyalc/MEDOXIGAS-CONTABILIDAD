"use client";

import { useState } from "react";

import { cn } from "cn";

import { ChevronDown, Sparkles, ThumbsDown, ThumbsUp } from "@/components/icons";
import { Button } from "@/components/ui/button";

interface Props {
  readonly texto: string;
}

/** Tarjeta «Resumen / Beta» del estado de resultados, idéntica a la de Alegra. */
export function ResumenEstado({ texto }: Props) {
  const [abierto, setAbierto] = useState(true);
  const [voto, setVoto] = useState<"up" | "down" | null>(null);

  return (
    <section className="w-full rounded-2xl border border-slate-400/20 bg-slate-50">
      <div
        className={cn("flex h-10 w-full items-center justify-between p-3", abierto && "border-b border-slate-400/20")}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="text-primary size-6" aria-hidden="true" />
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-500">Resumen</span>
            <span className="rounded-md bg-indigo-100 px-1.5 py-px text-[10px] leading-4 font-medium text-indigo-700">
              Beta
            </span>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-expanded={abierto}
          aria-label={abierto ? "Contraer resumen" : "Expandir resumen"}
          onClick={() => setAbierto((previo) => !previo)}
          className="text-slate-400 print:hidden"
        >
          {abierto ? <ChevronDown className="rotate-180" /> : <ChevronDown />}
        </Button>
      </div>
      {abierto ? (
        <div className="w-full">
          <div className="flex flex-col gap-3 px-4 py-3">
            <p className="text-sm text-slate-700">{texto}</p>
            <div className="flex w-full items-center justify-between">
              <Button
                type="button"
                variant="outline"
                className="border-primary/50 text-secondary-foreground hover:bg-secondary h-7 rounded-full bg-white px-3 text-xs font-normal"
              >
                Saber más
              </Button>
              <div className="flex items-center gap-2 print:hidden">
                <span className="text-xs text-slate-500">¿Te pareció útil?</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-xs"
                  aria-label="Útil"
                  aria-pressed={voto === "up"}
                  onClick={() => setVoto((previo) => (previo === "up" ? null : "up"))}
                  className={cn("size-7", voto === "up" && "border-primary text-primary")}
                >
                  <ThumbsUp />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-xs"
                  aria-label="No útil"
                  aria-pressed={voto === "down"}
                  onClick={() => setVoto((previo) => (previo === "down" ? null : "down"))}
                  className={cn("size-7", voto === "down" && "border-primary text-primary")}
                >
                  <ThumbsDown />
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
