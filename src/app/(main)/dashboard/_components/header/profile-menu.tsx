"use client";

import * as React from "react";

import { LogOut, SlidersHorizontal } from "lucide-react";

import { salir } from "@/app/login/actions";
import { AvatarInicial } from "@/components/avatar-inicial";
import { PanelPreferencias } from "@/components/preferencias/panel-preferencias";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ProfileMenu({ nombre, correo }: { readonly nombre: string | null; readonly correo: string | null }) {
  const [saliendo, startTransition] = React.useTransition();
  const [preferenciasAbiertas, setPreferenciasAbiertas] = React.useState(false);
  const nombreVisible = nombre?.trim() || correo || "Sin sesión";

  function cerrarSesion() {
    startTransition(async () => {
      await salir();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label="Abrir menú de perfil"
              className="focus-visible:ring-ring rounded-full outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            />
          }
        >
          <AvatarInicial nombre={nombre} correo={correo} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <div className="flex items-center gap-3 px-2 py-2">
            <AvatarInicial nombre={nombre} correo={correo} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{nombreVisible}</p>
              {nombre?.trim() ? <p className="text-muted-foreground truncate text-xs">{correo}</p> : null}
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setPreferenciasAbiertas(true)}>
            <SlidersHorizontal />
            Preferencias
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" disabled={saliendo} onClick={cerrarSesion}>
            <LogOut />
            {saliendo ? "Cerrando…" : "Cerrar sesión"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <PanelPreferencias open={preferenciasAbiertas} onOpenChange={setPreferenciasAbiertas} />
    </>
  );
}
