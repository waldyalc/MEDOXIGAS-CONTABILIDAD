"use client";

import Image from "next/image";
import Link from "next/link";

import { cn } from "cn";
import { useShallow } from "zustand/react/shallow";

import { Sidebar, SidebarContent, SidebarHeader, SidebarTrigger } from "@/components/ui/sidebar";
import type { Rol } from "@/lib/auth/rol";
import { filtrarItemsPorRol } from "@/navigation/sidebar/sidebar-items";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";

import { NavMain } from "./nav-main";

export function AppSidebar({ rol, className, ...props }: React.ComponentProps<typeof Sidebar> & { rol: Rol | null }) {
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
    <Sidebar
      {...props}
      variant={variant}
      collapsible={collapsible}
      className={cn("dark:border-sidebar-border border-[#e2e8f0]", className)}
    >
      <SidebarHeader className="h-[70px] shrink-0 flex-row items-center justify-between gap-0 border-b border-[#e2e8f0] py-0 pr-3 pl-[21px] group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 dark:border-white/10">
        <Link
          href="/dashboard"
          aria-label="Medoxigas Contabilidad"
          className="flex min-w-0 items-center group-data-[collapsible=icon]:hidden"
        >
          <Image
            src="/marca/logo-medoxigas.png"
            alt="Medoxigas"
            width={500}
            height={260}
            sizes="120px"
            priority
            className="h-[46px] w-auto object-contain object-left dark:brightness-0 dark:invert"
          />
        </Link>
        <SidebarTrigger className="dark:text-sidebar-foreground/60 dark:hover:text-sidebar-foreground size-8 shrink-0 text-[#94a3b8] hover:bg-[#f2f5f8] hover:text-[#334155] dark:hover:bg-white/10 [&_svg]:size-[22px]! [&_svg]:stroke-[1.6]" />
      </SidebarHeader>
      <SidebarContent className="pt-[10px] group-data-[collapsible=icon]:pt-2">
        <NavMain items={grupos} />
      </SidebarContent>
    </Sidebar>
  );
}
