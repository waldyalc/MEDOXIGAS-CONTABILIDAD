"use client";

import { Store } from "lucide-react";

import { Separator } from "@/components/ui/separator";

import { EstadoTurnoPos } from "./estado-turno-pos";
import { NavegacionPos } from "./navegacion-pos";
import { SalirPos } from "./salir-pos";
import { SelectorTerminal } from "./selector-terminal";
import { UsuarioPos } from "./usuario-pos";

export interface EncabezadoPosProps {
  empresa: { nombre: string | null; logo_url: string | null };
  terminales: { id: string; nombre: string }[];
  terminal: { id: string; nombre: string };
  turno: { numero: number; estado: "abierto" | "cerrado"; abierto_en: string } | null;
  usuario: { nombre: string | null; correo: string | null };
}

export function EncabezadoPos({ empresa, terminales, terminal, turno, usuario }: EncabezadoPosProps) {
  const nombre = empresa.nombre?.trim() || "Punto de venta";

  return (
    <header className="border-border bg-card sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:px-4 print:hidden">
      <div className="flex min-w-0 items-center gap-2">
        {empresa.logo_url ? (
          // biome-ignore lint/performance/noImgElement: logo configurable de la empresa
          <img src={empresa.logo_url} alt={nombre} className="size-7 shrink-0 rounded object-contain" />
        ) : (
          <Store className="text-primary size-6 shrink-0" aria-hidden="true" />
        )}
        <span className="hidden max-w-[220px] truncate text-sm font-semibold sm:inline" title={nombre}>
          {nombre}
        </span>
      </div>

      <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />

      <SelectorTerminal terminales={terminales} activa={terminal} />

      <div className="ml-1 flex min-w-0 flex-1 items-center justify-center">
        <NavegacionPos />
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <EstadoTurnoPos turno={turno} />
        <UsuarioPos nombre={usuario.nombre} correo={usuario.correo} />
        <SalirPos />
      </div>
    </header>
  );
}
