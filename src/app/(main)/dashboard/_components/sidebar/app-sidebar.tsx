"use client";

import Image from "next/image";
import Link from "next/link";

import { cn } from "cn";
import { useShallow } from "zustand/react/shallow";

import { Sidebar, SidebarContent, SidebarHeader, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import type { Rol } from "@/lib/auth/rol";
import { filtrarItemsPorRol } from "@/navigation/sidebar/sidebar-items";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";

import { NavMain } from "./nav-main";

export function AppSidebar({ rol, className, ...props }: React.ComponentProps<typeof Sidebar> & { rol: Rol | null }) {
  const { setOpenMobile } = useSidebar();
  const { sidebarVariant, sidebarCollapsible, isSynced } = usePreferencesStore(
    useShallow((s) => ({
      sidebarVariant: s.values.sidebar_variant,
      sidebarCollapsible: s.values.sidebar_collapsible,
      isSynced: s.isSynced,
    })),
  );

  const variant = isSynced ? sidebarVariant : props.variant;
  const collapsible = isSynced ? sidebarCollapsible : props.collapsible;
  const grupos = filtrarItemsPorRol(rol);

  return (
    <Sidebar {...props} variant={variant} collapsible={collapsible} className={cn("border-sidebar-border", className)}>
      <SidebarHeader className="h-[70px] shrink-0 flex-row items-center justify-between gap-0 px-2 py-[3px]! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
        <Link
          href="/dashboard"
          aria-label="Medoxigas Contabilidad"
          onClick={() => setOpenMobile(false)}
          className="flex min-w-0 items-center group-data-[collapsible=icon]:hidden"
        >
          <Image
            src="/marca/logo-medoxigas.png"
            alt="Medoxigas"
            width={500}
            height={260}
            sizes="170px"
            priority
            className="h-16 w-auto max-w-[170px] object-contain object-left dark:brightness-0 dark:invert"
          />
        </Link>
        <SidebarTrigger className="dark:text-sidebar-foreground/60 dark:hover:text-sidebar-foreground size-10 shrink-0 rounded-[8px] p-2 text-slate-400 hover:bg-slate-200/45 hover:text-slate-900 dark:hover:bg-white/[0.06] [&_svg]:size-5! [&_svg]:stroke-[1.6]" />
      </SidebarHeader>
      <SidebarContent className="gap-2 p-2 group-data-[collapsible=icon]:p-2">
        <NavMain items={grupos} />
      </SidebarContent>
    </Sidebar>
  );
}
