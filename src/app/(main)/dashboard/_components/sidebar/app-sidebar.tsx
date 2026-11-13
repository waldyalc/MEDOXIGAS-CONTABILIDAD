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
            <SidebarMenuButton size="lg" render={<Link prefetch={false} href="/dashboard" />} tooltip={APP_CONFIG.name}>
              <Image
                src="/marca/logo-medoxigas-cuadrado.png"
                alt="Medoxigas"
                width={32}
                height={32}
                className="size-8 shrink-0 rounded-md"
              />
              <span className="text-sm leading-tight font-semibold">{APP_CONFIG.name}</span>
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
