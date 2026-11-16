"use client";

import Image from "next/image";
import Link from "next/link";

import { useShallow } from "zustand/react/shallow";

import { Sidebar, SidebarContent, SidebarHeader } from "@/components/ui/sidebar";
import type { Rol } from "@/lib/auth/rol";
import { filtrarItemsPorRol } from "@/navigation/sidebar/sidebar-items";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";

import { NavMain } from "./nav-main";
export function AppSidebar({ rol, ...props }: React.ComponentProps<typeof Sidebar> & { rol: Rol | null }) {
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
    <Sidebar {...props} variant={variant} collapsible={collapsible}>
      <SidebarHeader className="px-4 pt-4 pb-2 group-data-[collapsible=icon]:px-2">
        <Link
          href="/dashboard"
          aria-label="Medoxigas Contabilidad"
          className="flex h-8 shrink-0 items-center group-data-[collapsible=icon]:justify-center"
        >
          <span className="relative block h-8 w-[92px] shrink-0 overflow-hidden group-data-[collapsible=icon]:hidden">
            <Image
              src="/marca/logo-medoxigas.png"
              alt="Medoxigas"
              width={500}
              height={260}
              priority
              className="absolute -top-[10px] -left-[10px] h-[60px] w-[116px] max-w-none dark:brightness-0 dark:invert"
            />
          </span>
          <span className="relative hidden h-7 w-[19px] shrink-0 overflow-hidden group-data-[collapsible=icon]:block">
            <Image
              src="/marca/logo-medoxigas.png"
              alt="Medoxigas"
              width={500}
              height={260}
              priority
              className="absolute -top-[9px] -left-[9px] h-[54px] w-[103px] max-w-none dark:brightness-0 dark:invert"
            />
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={grupos} />
      </SidebarContent>
    </Sidebar>
  );
}
