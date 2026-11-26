"use client";

import * as React from "react";

import Link from "next/link";

import { cn } from "cn";
import { useShallow } from "zustand/react/shallow";

import { salir } from "@/app/login/actions";
import { ChevronDown, History, LogOut, Moon, Settings, Sun, UserRound, Users } from "@/components/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Rol } from "@/lib/auth/rol";
import { limpiarCachePOS } from "@/lib/cache-pos";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";

const ETIQUETA_ROL: Record<Rol, string> = {
  admin: "Administrador",
  contador: "Contador",
  lector: "Lector",
};

function inicialesPerfil(nombre: string | null, correo: string | null) {
  const limpio = nombre?.trim() ?? "";
  if (limpio) {
    const partes = limpio.split(/\s+/).filter(Boolean);
    if (partes.length >= 2) {
      const primera = partes[0]?.charAt(0) ?? "";
      const ultima = partes[partes.length - 1]?.charAt(0) ?? "";
      return `${primera}${ultima}`.toUpperCase();
    }
    return limpio.charAt(0).toUpperCase();
  }
  return correo?.trim().charAt(0).toUpperCase() || "?";
}

function AvatarPerfil({ nombre, correo }: { readonly nombre: string | null; readonly correo: string | null }) {
  return (
    <span
      aria-hidden="true"
      className="bg-primary/10 text-primary dark:bg-primary/20 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
    >
      {inicialesPerfil(nombre, correo)}
    </span>
  );
}

function EnlaceMenu({
  href,
  icono: Icono,
  children,
}: {
  readonly href: string;
  readonly icono: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  readonly children: React.ReactNode;
}) {
  return (
    <DropdownMenuItem render={<Link href={href} prefetch={false} />} className="gap-2.5 rounded-lg px-2.5 py-2">
      <Icono aria-hidden className="text-muted-foreground size-4" />
      <span>{children}</span>
    </DropdownMenuItem>
  );
}

function BotonTema({
  modo,
  activo,
  icono: Icono,
  children,
  onClick,
}: {
  readonly modo: "light" | "dark";
  readonly activo: boolean;
  readonly icono: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  readonly children: React.ReactNode;
  readonly onClick: (modo: "light" | "dark") => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={() => onClick(modo)}
      className={cn(
        "focus-visible:ring-ring flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm transition-colors outline-none focus-visible:ring-2",
        activo ? "bg-background text-foreground font-medium shadow-xs" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icono aria-hidden className="size-4" />
      {children}
    </button>
  );
}

export function ProfileMenu({
  nombre,
  correo,
  rol,
}: {
  readonly nombre: string | null;
  readonly correo: string | null;
  readonly rol: Rol | null;
}) {
  const [saliendo, startTransition] = React.useTransition();
  const { resolvedThemeMode, setPreference } = usePreferencesStore(
    useShallow((state) => ({
      resolvedThemeMode: state.resolvedThemeMode,
      setPreference: state.setPreference,
    })),
  );
  const nombreVisible = nombre?.trim() || correo || "Sin sesión";

  function cerrarSesion() {
    startTransition(async () => {
      try {
        await limpiarCachePOS();
      } finally {
        await salir();
      }
    });
  }

  function cambiarTema(modo: "light" | "dark") {
    setPreference("theme_mode", modo);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Abrir menú de perfil"
            className="border-border/70 bg-card hover:bg-muted/60 focus-visible:ring-ring flex items-center gap-2.5 rounded-xl border px-2.5 py-1.5 transition-colors outline-none focus-visible:ring-2"
          />
        }
      >
        <AvatarPerfil nombre={nombre} correo={correo} />
        <span className="hidden min-w-0 flex-col text-left sm:flex">
          <span className="text-foreground max-w-[160px] truncate text-sm leading-tight font-medium">
            {nombreVisible}
          </span>
          {correo ? (
            <span className="text-muted-foreground max-w-[160px] truncate text-xs leading-tight">{correo}</span>
          ) : null}
        </span>
        <ChevronDown aria-hidden className="text-muted-foreground size-4 shrink-0" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="w-72 rounded-xl p-0 shadow-lg">
        <div className="px-4 py-3.5">
          <p className="text-foreground truncate text-sm font-semibold">{nombreVisible}</p>
          {correo ? <p className="text-muted-foreground mt-0.5 truncate text-xs">{correo}</p> : null}
          {rol ? (
            <span className="bg-primary/10 text-primary dark:bg-primary/20 mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
              {ETIQUETA_ROL[rol]}
            </span>
          ) : null}
        </div>

        <DropdownMenuSeparator className="my-0" />

        <div className="p-1.5">
          <EnlaceMenu href="/dashboard/configuracion" icono={Settings}>
            Configuración
          </EnlaceMenu>
          {rol === "admin" ? (
            <EnlaceMenu href="/dashboard/configuracion/usuarios" icono={Users}>
              Usuarios
            </EnlaceMenu>
          ) : null}
          <EnlaceMenu href="/dashboard/configuracion/auditoria" icono={History}>
            Auditoría
          </EnlaceMenu>
          <EnlaceMenu href="/dashboard/perfil" icono={UserRound}>
            Mi perfil y seguridad
          </EnlaceMenu>
        </div>

        <DropdownMenuSeparator className="my-0" />

        <div className="px-4 py-3">
          <p className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wider uppercase">TEMA</p>
          <fieldset aria-label="Tema" className="bg-muted grid grid-cols-2 gap-1 rounded-lg p-1">
            <BotonTema modo="light" activo={resolvedThemeMode === "light"} icono={Sun} onClick={cambiarTema}>
              Claro
            </BotonTema>
            <BotonTema modo="dark" activo={resolvedThemeMode === "dark"} icono={Moon} onClick={cambiarTema}>
              Oscuro
            </BotonTema>
          </fieldset>
        </div>

        <DropdownMenuSeparator className="my-0" />

        <div className="p-1.5">
          <DropdownMenuItem disabled={saliendo} onClick={cerrarSesion} className="gap-2.5 rounded-lg px-2.5 py-2">
            <LogOut aria-hidden className="text-muted-foreground size-4" />
            <span>{saliendo ? "Cerrando…" : "Cerrar sesión"}</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
