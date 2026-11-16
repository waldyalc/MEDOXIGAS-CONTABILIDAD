"use client";

import Image from "next/image";
import Link from "next/link";

import { useShallow } from "zustand/react/shallow";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { APP_CONFIG } from "@/config/app-config";
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
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />} tooltip={APP_CONFIG.name}>
              <Image
                src="/marca/logo-medoxigas-menu.png"
                alt={APP_CONFIG.name}
                width={500}
                height={180}
                className="h-10 w-auto max-w-[150px] object-contain object-left group-data-[collapsible=icon]:size-6 group-data-[collapsible=icon]:object-cover"
              />
              <span className="sr-only">{APP_CONFIG.name}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={grupos} />
      </SidebarContent>
    </Sidebar>
  );
}
