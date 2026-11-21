"use client";

import { Fragment, useState } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "cn";

import { ChevronDown } from "@/components/icons";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type {
  NavBadge,
  NavGroup,
  NavMainItem,
  NavMainLinkItem,
  NavMainParentItem,
} from "@/navigation/sidebar/sidebar-items";

interface NavMainProps {
  readonly items: readonly NavGroup[];
}

interface NavItemProps {
  readonly item: NavMainItem;
  readonly esEnlaceActivo: (url: string) => boolean;
  readonly esSubItemActivo: (url: string) => boolean;
  readonly onNavigate: (url: string) => void;
}

interface NavLinkItemProps {
  readonly item: NavMainLinkItem;
  readonly isActive: boolean;
  readonly onNavigate: (url: string) => void;
}

interface NavCollapsibleItemProps {
  readonly item: NavMainParentItem;
  readonly defaultOpen: boolean;
  readonly esSubItemActivo: (url: string) => boolean;
  readonly onNavigate: (url: string) => void;
}

const estiloItem =
  "relative h-8 gap-2 rounded-[6px] px-2 py-1.5 font-[family-name:var(--font-inter)] text-sm leading-[21px] font-normal tracking-normal text-slate-700 before:absolute before:top-1/2 before:left-0 before:h-4 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-primary before:opacity-0 before:content-[''] group-data-[mobile=true]:before:h-3 hover:bg-slate-200/45 hover:text-slate-900 active:bg-slate-200/70 focus-visible:ring-primary data-active:bg-slate-200/45 data-active:font-normal data-active:text-slate-900 data-active:before:opacity-100 data-active:hover:bg-slate-200/70 data-active:active:bg-slate-200/90 dark:text-sidebar-foreground/85 dark:before:bg-primary dark:hover:bg-white/[0.06] dark:hover:text-sidebar-foreground dark:active:bg-white/[0.09] dark:data-active:bg-white/[0.09] dark:data-active:text-sidebar-foreground dark:data-active:hover:bg-white/[0.09] dark:data-active:active:bg-white/[0.12] [&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:text-slate-400 [&_svg]:stroke-[1.6] data-active:[&_svg]:text-slate-900 dark:[&_svg]:text-sidebar-foreground/50 dark:data-active:[&_svg]:text-sidebar-foreground";

const estiloSubItem =
  "relative mb-1 h-8 min-h-8 translate-x-0 gap-2 rounded-[6px] px-2 font-[family-name:var(--font-inter)] text-sm leading-[21px] font-normal tracking-normal text-slate-900 before:absolute before:top-1/2 before:left-0 before:h-4 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-primary before:opacity-0 before:content-[''] group-data-[mobile=true]:before:h-3 hover:bg-slate-200/45 hover:text-slate-900 active:bg-slate-200/70 focus-visible:ring-primary data-active:bg-slate-200/45 data-active:font-normal data-active:text-slate-900 data-active:before:opacity-100 data-active:hover:bg-slate-200/70 data-active:active:bg-slate-200/90 dark:text-sidebar-foreground dark:hover:bg-white/[0.06] dark:hover:text-sidebar-foreground dark:active:bg-white/[0.09] dark:data-active:bg-white/[0.09] dark:data-active:text-sidebar-foreground dark:data-active:hover:bg-white/[0.09] dark:data-active:active:bg-white/[0.12] [&_svg]:hidden";

function hasSubItems(item: NavMainItem): item is NavMainParentItem {
  return Boolean(item.subItems?.length);
}

const INICIO = "/dashboard";

/** Ruta activa más larga: /dashboard/compras/pagos gana a /dashboard/compras. */
function rutaMasEspecifica(ruta: string, urls: readonly string[]): string | null {
  let activa: string | null = null;

  for (const url of urls) {
    const coincide = ruta === url || ruta.startsWith(`${url}/`);

    if (coincide && (activa === null || url.length > activa.length)) {
      activa = url;
    }
  }

  return activa;
}

export function NavMain({ items }: NavMainProps) {
  const path = usePathname();
  const { setOpenMobile } = useSidebar();
  // Al hacer clic se marca el destino al instante; el estado se descarta solo
  // cuando la ruta cambia, sin efectos ni esperas a la navegación.
  const [pendiente, setPendiente] = useState<{ url: string; desde: string } | null>(null);
  const urlPendiente = pendiente?.desde === path ? pendiente.url : null;

  const urlsSubitems = items.flatMap((group) =>
    group.items.flatMap((item) => (hasSubItems(item) ? item.subItems.map((sub) => sub.url) : [])),
  );

  const urlSubActiva = urlPendiente ?? rutaMasEspecifica(path, urlsSubitems);

  const onNavigate = (url: string) => {
    setPendiente({ url, desde: path });
    setOpenMobile(false);
  };

  const esEnlaceActivo = (url: string) => {
    if (urlPendiente) {
      return url === urlPendiente;
    }

    if (url === INICIO) {
      return path === INICIO;
    }

    return path === url || path.startsWith(`${url}/`);
  };

  const esSubItemActivo = (url: string) => {
    return url === urlSubActiva;
  };

  return (
    <>
      {items.map((group) => (
        <SidebarGroup key={group.id} className="p-0">
          {group.label ? (
            <SidebarGroupLabel className="h-auto px-2 pt-3 pb-0.5 group-data-[state=collapsed]:hidden">
              {group.label}
            </SidebarGroupLabel>
          ) : null}
          <SidebarGroupContent>
            <SidebarMenu className="gap-0">
              {group.items.map((item) => (
                <Fragment key={item.id}>
                  <NavItem
                    item={item}
                    esEnlaceActivo={esEnlaceActivo}
                    esSubItemActivo={esSubItemActivo}
                    onNavigate={onNavigate}
                  />
                  {item.separadorDespues ? (
                    <li aria-hidden="true" className="flex h-4 items-center py-1">
                      <div className="dark:bg-sidebar-border h-px w-full bg-slate-200" />
                    </li>
                  ) : null}
                </Fragment>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}

function NavItem({ item, esEnlaceActivo, esSubItemActivo, onNavigate }: NavItemProps) {
  if (!hasSubItems(item)) {
    return <NavLinkItem item={item} isActive={esEnlaceActivo(item.url)} onNavigate={onNavigate} />;
  }

  return (
    <NavCollapsibleItem
      item={item}
      defaultOpen={item.subItems.some((sub) => esSubItemActivo(sub.url))}
      esSubItemActivo={esSubItemActivo}
      onNavigate={onNavigate}
    />
  );
}

function NavLinkItem({ item, isActive, onNavigate }: NavLinkItemProps) {
  const Icon = item.icon;
  const contenido = (
    <>
      {Icon ? <Icon /> : null}
      <span className="truncate">{item.title}</span>
    </>
  );

  return (
    <SidebarMenuItem>
      {item.disabled ? (
        <SidebarMenuButton disabled tooltip={item.title} className={estiloItem}>
          {contenido}
        </SidebarMenuButton>
      ) : (
        <SidebarMenuButton
          render={
            <Link
              href={item.url}
              target={item.newTab ? "_blank" : undefined}
              rel={item.newTab ? "noreferrer" : undefined}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onNavigate(item.url)}
            />
          }
          tooltip={item.title}
          isActive={isActive}
          className={estiloItem}
        >
          {contenido}
        </SidebarMenuButton>
      )}
      <NavItemBadge badge={item.badge} />
    </SidebarMenuItem>
  );
}

function NavCollapsibleItem({ item, defaultOpen, esSubItemActivo, onNavigate }: NavCollapsibleItemProps) {
  const Icon = item.icon;
  const subItemActivo = item.subItems.find((sub) => esSubItemActivo(sub.url));

  return (
    <Collapsible
      key={subItemActivo?.url ?? "sin-subitem-activo"}
      render={<li data-slot="sidebar-menu-item" data-sidebar="menu-item" className="group/menu-item relative" />}
      defaultOpen={defaultOpen}
      className="group/collapsible"
    >
      <CollapsibleTrigger
        render={<SidebarMenuButton tooltip={item.title} disabled={item.disabled} className={estiloItem} />}
      >
        {Icon && <Icon weight="duotone" size={20} />}
        <span className="truncate">{item.title}</span>
        <ChevronDown className="dark:text-sidebar-foreground/50 ml-auto size-5! shrink-0 text-slate-400 transition-transform duration-200 group-data-[state=collapsed]:hidden group-data-panel-open/menu-button:rotate-180" />
      </CollapsibleTrigger>
      <NavItemBadge badge={item.badge} />

      <CollapsibleContent>
        <SidebarMenuSub className="dark:border-sidebar-border mx-0 my-2 ml-[17px] translate-x-0 gap-0 border-l border-slate-200 px-0 pl-[10px] group-data-[state=collapsed]:hidden">
          {item.subItems.map((subItem) => {
            const SubIcon = subItem.icon;

            return (
              <SidebarMenuSubItem key={subItem.id}>
                <SidebarMenuSubButton
                  render={
                    <Link
                      href={subItem.url}
                      target={subItem.newTab ? "_blank" : undefined}
                      rel={subItem.newTab ? "noreferrer" : undefined}
                      aria-current={esSubItemActivo(subItem.url) ? "page" : undefined}
                      onClick={() => onNavigate(subItem.url)}
                    />
                  }
                  aria-disabled={subItem.disabled}
                  isActive={esSubItemActivo(subItem.url)}
                  className={estiloSubItem}
                >
                  {SubIcon && <SubIcon weight="duotone" size={20} />}
                  <span className="truncate">{subItem.title}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            );
          })}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  );
}

function NavItemBadge({ badge }: { badge?: NavBadge }) {
  if (!badge) {
    return null;
  }

  return (
    <SidebarMenuBadge
      className={cn(
        "rounded-sm border px-1.5 capitalize group-data-[state=collapsed]:hidden",
        badge === "new" &&
          "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 peer-hover/menu-button:text-emerald-700 peer-data-active/menu-button:text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300 dark:peer-hover/menu-button:text-emerald-300 dark:peer-data-active/menu-button:text-emerald-300",
        badge === "soon" &&
          "border-zinc-500/20 bg-zinc-500/10 text-zinc-600 peer-hover/menu-button:text-zinc-600 peer-data-active/menu-button:text-zinc-600 dark:border-zinc-400/25 dark:bg-zinc-400/10 dark:text-zinc-300 dark:peer-hover/menu-button:text-zinc-300 dark:peer-data-active/menu-button:text-zinc-300",
        badge === "updated" &&
          "border-blue-600/20 bg-blue-500/10 text-blue-700 peer-hover/menu-button:text-blue-700 peer-data-active/menu-button:text-blue-700 dark:border-blue-400/25 dark:bg-blue-400/10 dark:text-blue-300 dark:peer-hover/menu-button:text-blue-300 dark:peer-data-active/menu-button:text-blue-300",
      )}
    >
      {badge}
    </SidebarMenuBadge>
  );
}
