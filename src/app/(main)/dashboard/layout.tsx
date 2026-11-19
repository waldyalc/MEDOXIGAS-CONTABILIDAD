import type { ReactNode } from "react";

import { cookies } from "next/headers";

import { cn } from "cn";

import { AppSidebar } from "@/app/(main)/dashboard/_components/sidebar/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { getPerfil } from "@/lib/auth/rol";
import { getPreference } from "@/server/server-actions";

import { BusquedaGlobal } from "./_components/header/busqueda-global";
import { ProfileMenu } from "./_components/header/profile-menu";
import { ThemeSwitcher } from "./_components/header/theme-switcher";

export default async function Layout({ children }: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const [variant, collapsible] = await Promise.all([
    getPreference("sidebar_variant"),
    getPreference("sidebar_collapsible"),
  ]);
  const perfil = await getPerfil();

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      style={
        {
          "--sidebar-width": "271px",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant={variant} collapsible={collapsible} rol={perfil?.rol ?? null} className="print:hidden" />
      <SidebarInset
        className={cn(
          "[html[data-content-layout=centered]_&>*]:mx-auto",
          "[html[data-content-layout=centered]_&>*]:w-full",
          "[html[data-content-layout=centered]_&>*]:max-w-screen-2xl",
          "peer-data-[variant=inset]:border",
          "bg-muted dark:bg-background",
          "[--dashboard-header-height:70px]",
          "min-w-0 overflow-x-clip",
        )}
      >
        <header
          className={cn(
            "border-border bg-card dark:bg-background flex h-[70px] shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-[70px] print:hidden",
            // Handle sticky navbar style with conditional classes so blur, background, z-index, and rounded corners remain consistent across all SidebarVariant layouts.
            "[html[data-navbar-style=sticky]_&]:bg-background/50 [html[data-navbar-style=sticky]_&]:sticky [html[data-navbar-style=sticky]_&]:top-0 [html[data-navbar-style=sticky]_&]:z-50 [html[data-navbar-style=sticky]_&]:overflow-hidden [html[data-navbar-style=sticky]_&]:rounded-t-[inherit] [html[data-navbar-style=sticky]_&]:backdrop-blur-md",
          )}
        >
          <div className="flex w-full items-center gap-2 px-4 lg:px-6">
            <div className="flex flex-1 items-center gap-1 lg:gap-2">
              <SidebarTrigger className="-ml-1 md:hidden" />
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-center md:max-w-xl md:flex-[2]">
              <BusquedaGlobal rol={perfil?.rol ?? null} />
            </div>
            <div className="flex flex-1 items-center justify-end gap-2">
              <ThemeSwitcher />
              <ProfileMenu nombre={perfil?.nombre ?? null} correo={perfil?.correo ?? null} />
            </div>
          </div>
        </header>
        {/* Pages can set data-content-padding="false" to render full-bleed app layouts. */}
        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden p-4 has-data-[content-padding=false]:p-0 md:p-6 md:has-data-[content-padding=false]:p-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
