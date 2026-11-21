"use client";

import { useTransition } from "react";

import { Loader2, LogOut } from "lucide-react";

import { salir } from "@/app/login/actions";
import { AvatarInicial } from "@/components/avatar-inicial";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UsuarioPos({ nombre, correo }: { nombre: string | null; correo: string | null }) {
  const [pendiente, iniciar] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" className="h-10 gap-2 px-1.5" aria-label="Menú del usuario">
            <AvatarInicial nombre={nombre} correo={correo} />
            <span className="hidden max-w-[140px] truncate text-sm xl:inline">{nombre ?? correo ?? "Usuario"}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-foreground font-medium">{nombre ?? "Usuario"}</span>
          <span className="text-muted-foreground text-xs">{correo ?? ""}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={pendiente} onClick={() => iniciar(() => void salir())}>
          {pendiente ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LogOut aria-hidden="true" />}
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
