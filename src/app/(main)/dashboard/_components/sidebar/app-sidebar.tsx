"use client";

import { useEffect, useRef, useState } from "react";

import Image from "next/image";
import Link from "next/link";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "cn";

import { AvatarInicial } from "@/components/avatar-inicial";
import { PanelLeftIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { SidebarContent, SidebarFooter, SidebarHeader, useSidebar } from "@/components/ui/sidebar";
import { APP_CONFIG } from "@/config/app-config";
import type { Perfil } from "@/lib/auth/rol";
import { filtrarItemsPorRol } from "@/navigation/sidebar/sidebar-items";

import { NavMain } from "./nav-main";

// Alegra pasa a cajón por debajo de 1024 px (el hook use-mobile usa 768).
function useConsultaMedia(consulta: string): boolean {
  const [coincide, setCoincide] = useState(false);

  useEffect(() => {
    const lista = window.matchMedia(consulta);
    const alCambiar = () => setCoincide(lista.matches);
    alCambiar();
    lista.addEventListener("change", alCambiar);
    return () => lista.removeEventListener("change", alCambiar);
  }, [consulta]);

  return coincide;
}

const estiloBotonMenu =
  "size-10 shrink-0 rounded-[8px] p-2 text-slate-400 hover:bg-slate-200/45 hover:text-slate-900 active:bg-slate-200/70 dark:text-sidebar-foreground/60 dark:hover:bg-white/[0.06] dark:hover:text-sidebar-foreground [&_svg]:size-5! [&_svg]:stroke-[1.6]";

interface AppSidebarProps {
  readonly perfil: Perfil | null;
  readonly className?: string;
}

export function AppSidebar({ perfil, className }: AppSidebarProps) {
  const { open, setOpen, openMobile, setOpenMobile } = useSidebar();
  const esCajon = useConsultaMedia("(max-width: 1023px)");
  const [hoverRiel, setHoverRiel] = useState(false);
  const [bloqueaHover, setBloqueaHover] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    };
  }, []);

  const alternarMenu = () => {
    if (esCajon) {
      setOpenMobile(false);
      return;
    }

    if (open) {
      // Alegra bloquea la expansión por hover ~350 ms justo después de colapsar.
      setBloqueaHover(true);
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => setBloqueaHover(false), 350);
    }
    setOpen(!open);
  };

  // Colapsado: riel fijo de 53 px sobre el contenido; al pasar el mouse se
  // expande a 271 px flotando, sin mover el contenido, como en Alegra.
  const expandido = open || (hoverRiel && !bloqueaHover);
  const grupos = filtrarItemsPorRol(perfil?.rol ?? null);

  const contenido = (
    <>
      <SidebarHeader className="h-16 shrink-0 flex-row items-center justify-between gap-0 px-3 py-0 group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:px-1">
        <Link
          href="/dashboard"
          aria-label="Medoxigas Contabilidad"
          onClick={() => setOpenMobile(false)}
          className="flex min-w-0 items-center overflow-hidden group-data-[state=collapsed]:hidden"
        >
          <Image
            src="/marca/logo-medoxigas.png"
            alt="Medoxigas"
            width={500}
            height={260}
            sizes="96px"
            priority
            className="h-12 w-auto max-w-[170px] object-contain object-left dark:brightness-0 dark:invert"
          />
        </Link>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Alternar menú"
          onClick={alternarMenu}
          className={estiloBotonMenu}
        >
          <PanelLeftIcon />
        </Button>
      </SidebarHeader>
      <SidebarContent className="gap-2 px-3 pt-4 pb-2">
        <NavMain items={grupos} />
      </SidebarContent>
      <SidebarFooter className="dark:border-sidebar-border mt-auto gap-1 border-t border-slate-200 p-2">
        <div className="flex min-w-0 items-center gap-2 px-2 py-1">
          <AvatarInicial nombre={perfil?.nombre} correo={perfil?.correo} size="sm" />
          <div className="min-w-0">
            <p className="dark:text-sidebar-foreground truncate text-sm leading-[21px] font-medium text-slate-700">
              {perfil?.nombre?.trim() || perfil?.correo || "Sin sesión"}
            </p>
            {perfil?.nombre?.trim() ? (
              <p className="dark:text-sidebar-foreground/60 truncate text-xs leading-4 text-slate-500">
                {perfil.correo}
              </p>
            ) : null}
          </div>
        </div>
        <div className="dark:text-sidebar-foreground/60 flex items-center justify-between px-2 text-xs leading-4 text-slate-500 group-data-[state=collapsed]:hidden">
          <span>v{APP_CONFIG.version}</span>
          <a
            href="https://github.com/waldyalc/MEDOXIGAS-CONTABILIDAD/issues"
            target="_blank"
            rel="noreferrer"
            className="dark:hover:text-sidebar-foreground hover:text-slate-900 hover:underline"
          >
            Soporte
          </a>
        </div>
      </SidebarFooter>
    </>
  );

  return (
    <>
      {/* Hueco en el flujo: 271 px abierto, 0 colapsado (el riel flota encima). */}
      <div
        aria-hidden="true"
        data-slot="sidebar-gap"
        className={cn(
          "hidden shrink-0 transition-[width] duration-300 ease-[cubic-bezier(.4,0,.2,1)] lg:block print:hidden",
          open ? "w-[271px]" : "w-0",
        )}
      />
      <aside
        data-slot="sidebar"
        data-state={expandido ? "expanded" : "collapsed"}
        aria-label="Menú principal"
        onMouseEnter={() => setHoverRiel(true)}
        onMouseLeave={() => setHoverRiel(false)}
        className={cn(
          "group bg-sidebar text-sidebar-foreground dark:border-sidebar-border fixed inset-y-0 left-0 z-[60] hidden flex-col overflow-hidden border-r border-slate-200 transition-[width,box-shadow] duration-300 ease-[cubic-bezier(.4,0,.2,1)] lg:flex",
          expandido ? "w-[271px]" : "w-[53px]",
          !open && hoverRiel && "shadow-[0_4px_6px_-1px_rgba(0,0,0,.1),0_2px_4px_-2px_rgba(0,0,0,.1)]",
          className,
        )}
      >
        {contenido}
      </aside>
      {/* Móvil (<1024 px): cajón fijo de 271 px + velo slate-700 al 60 %. */}
      <DialogPrimitive.Root open={openMobile} onOpenChange={setOpenMobile}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-[80] bg-slate-700/60 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 lg:hidden" />
          <DialogPrimitive.Popup
            data-slot="sidebar"
            data-mobile="true"
            data-state="expanded"
            className="group bg-sidebar text-sidebar-foreground dark:border-sidebar-border fixed inset-y-0 left-0 z-[90] flex w-[271px] flex-col overflow-hidden border-r border-slate-200 transition-transform duration-200 ease-in-out data-ending-style:-translate-x-full data-starting-style:-translate-x-full lg:hidden"
          >
            <DialogPrimitive.Title className="sr-only">Menú de navegación</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Menú lateral de secciones del sistema
            </DialogPrimitive.Description>
            {contenido}
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}

/** Botón del topbar que abre el cajón en pantallas < 1024 px. */
export function BotonMenuMovil({ className }: { readonly className?: string }) {
  const { setOpenMobile } = useSidebar();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Abrir menú"
      onClick={() => setOpenMobile(true)}
      className={cn(estiloBotonMenu, "lg:hidden", className)}
    >
      <PanelLeftIcon />
    </Button>
  );
}
