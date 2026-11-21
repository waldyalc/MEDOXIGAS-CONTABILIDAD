"use client";

import { useTransition } from "react";

import { useRouter } from "next/navigation";

import { Check, ChevronDown } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { OpcionPeriodo, PeriodoId } from "@/lib/inicio/periodo";

interface Props {
  periodo: PeriodoId;
  opciones: readonly OpcionPeriodo[];
}

export function SelectorPeriodo({ periodo, opciones }: Props) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const actual = opciones.find((opcion) => opcion.id === periodo) ?? opciones[0];

  function cambiar(id: PeriodoId) {
    if (id === periodo) return;

    startTransition(() => {
      router.push(`/dashboard?periodo=${id}`);
    });
  }

  if (!actual) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            className="h-10 min-w-40 justify-between gap-3 rounded-[10px] px-4 text-sm font-medium"
            disabled={pendiente}
            aria-label="Cambiar periodo"
          />
        }
      >
        <span>{actual.etiqueta}</span>
        <ChevronDown className="text-muted-foreground size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {opciones.map((opcion) => (
          <DropdownMenuItem
            key={opcion.id}
            onClick={() => cambiar(opcion.id)}
            className="flex items-center justify-between gap-3 px-2 py-2"
          >
            <span className="flex flex-col items-start gap-0.5">
              <span className="text-sm font-medium">{opcion.etiqueta}</span>
              <span className="text-muted-foreground text-xs">{opcion.rango}</span>
            </span>
            {opcion.id === periodo ? <Check className="text-primary size-4" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
