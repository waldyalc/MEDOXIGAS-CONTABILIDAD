"use client";

import { useTransition } from "react";

import { cn } from "cn";

import { salir } from "@/app/login/actions";
import { AvatarInicial } from "@/components/avatar-inicial";
import { Loader2, LogOut } from "@/components/icons";

import { claseIconoMenu, itemMenuBase, itemMenuColapsado } from "./menu-pos-estilos";

/**
 * Pie del menú del POS: fila con el usuario (avatar + nombre y correo) y el
 * ítem «Salir», que cierra la sesión. En el riel colapsado queda el avatar y
 * el icono de salida centrados.
 */
export function UsuarioPos({
  nombre,
  correo,
  colapsado = false,
}: {
  nombre: string | null;
  correo: string | null;
  colapsado?: boolean;
}) {
  const [pendiente, iniciar] = useTransition();
  const etiqueta = nombre?.trim() || correo?.trim() || "Usuario";

  return (
    <>
      <div
        className={cn("flex h-8 w-full items-center gap-2 rounded-[6px]", colapsado ? "justify-center px-0" : "px-2")}
        title={etiqueta}
      >
        <AvatarInicial nombre={nombre} correo={correo} size="sm" />
        {colapsado ? null : (
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="text-foreground truncate text-sm font-medium">{nombre?.trim() || "Usuario"}</span>
            {correo ? <span className="text-muted-foreground truncate text-xs">{correo}</span> : null}
          </span>
        )}
      </div>

      <button
        type="button"
        disabled={pendiente}
        title="Salir (cerrar sesión)"
        className={cn(itemMenuBase, colapsado && itemMenuColapsado, "disabled:pointer-events-none disabled:opacity-30")}
        onClick={() => iniciar(() => void salir())}
      >
        {pendiente ? (
          <Loader2
            className="dark:text-sidebar-foreground/50 size-5 shrink-0 animate-spin text-slate-400"
            aria-hidden="true"
          />
        ) : (
          <LogOut aria-hidden="true" className={claseIconoMenu(false)} />
        )}
        <span className={cn("min-w-0 flex-1 truncate", colapsado && "hidden")}>Salir</span>
      </button>
    </>
  );
}
