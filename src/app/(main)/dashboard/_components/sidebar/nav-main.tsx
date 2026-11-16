"use client";

import { useState } from "react";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "cn";
import { ChevronRight } from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  readonly isItemActive: (item: NavMainItem) => boolean;
  readonly isSubItemActive: (url: string) => boolean;
  readonly isSubmenuOpen: (item: NavMainParentItem) => boolean;
  readonly onNavigate: (url: string) => void;
}

interface NavLinkItemProps {
  readonly item: NavMainLinkItem;
  readonly isActive: boolean;
  readonly showIconFallback: boolean;
  readonly onNavigate: (url: string) => void;
}

interface NavLinkIconProps {
  readonly item: NavMainLinkItem;
  readonly showFallback: boolean;
}

interface NavDropdownItemProps {
  readonly item: NavMainParentItem;
  readonly isActive: boolean;
  readonly isSubItemActive: (url: string) => boolean;
  readonly onNavigate: (url: string) => void;
}

interface NavCollapsibleItemProps {
  readonly item: NavMainParentItem;
  readonly isActive: boolean;
  readonly defaultOpen: boolean;
  readonly isSubItemActive: (url: string) => boolean;
  readonly onNavigate: (url: string) => void;
}

const estiloItem =
  "relative h-[38px] gap-2.5 rounded-md px-2.5 font-[family-name:var(--font-inter)] text-[14px] font-medium tracking-[-0.01em] before:absolute before:top-1/2 before:left-0 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-primary before:opacity-0 before:content-[''] hover:bg-sidebar-accent/40 hover:text-sidebar-foreground data-active:before:opacity-100 [&_svg]:size-[18px] [&_svg]:opacity-70 [&_svg]:stroke-[1.6] data-active:[&_svg]:opacity-100";

const estiloSubItem =
  "relative h-8 gap-2 rounded-md pr-2 pl-9 font-[family-name:var(--font-inter)] text-[13px]! font-normal tracking-[-0.01em] before:absolute before:top-1/2 before:left-0 before:h-4 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-primary before:opacity-0 before:content-[''] hover:bg-sidebar-accent/40 data-active:before:opacity-100 data-active:font-medium [&_svg]:size-4 [&_svg]:opacity-70 [&_svg]:stroke-[1.6] data-active:[&_svg]:opacity-100";

function IndicadorEnlace() {
  const { pending } = useLinkStatus();

  return (
    <span
      aria-hidden="true"
      className={cn(
        "ml-auto size-1.5 shrink-0 rounded-full bg-current opacity-0 transition-opacity duration-150",
        pending && "animate-pulse opacity-60",
      )}
    />
  );
}

function CollapsedIconFallback({ title }: { title: string }) {
  return (
    <span className="flex size-4 shrink-0 items-center justify-center rounded-xs text-[10px] font-medium outline">
      {title.slice(0, 1)}
    </span>
  );
}

function hasSubItems(item: NavMainItem): item is NavMainParentItem {
  return Boolean(item.subItems?.length);
}

export function NavMain({ items }: NavMainProps) {
  const path = usePathname();
  // Al hacer clic se marca el destino al instante; el estado se descarta solo
  // cuando la ruta cambia, sin efectos ni esperas a la navegación.
  const [pendiente, setPendiente] = useState<{ url: string; desde: string } | null>(null);
  const urlPendiente = pendiente?.desde === path ? pendiente.url : null;

  const onNavigate = (url: string) => {
    setPendiente({ url, desde: path });
  };

  const isItemActive = (item: NavMainItem) => {
    if (hasSubItems(item)) {
      return item.subItems.some((sub) => sub.url === urlPendiente || path.startsWith(sub.url));
    }

    return item.url === urlPendiente || path === item.url;
  };

  const isSubItemActive = (url: string) => {
    return url === urlPendiente || path === url;
  };

  const isSubmenuOpen = (item: NavMainParentItem) => {
    return item.subItems.some((sub) => sub.url === urlPendiente || path.startsWith(sub.url));
  };

  return (
    <>
      {items.map((group) => (
        <SidebarGroup key={group.id}>
          {items.length > 1 && group.label && (
            <SidebarGroupLabel className="text-muted-foreground h-6 px-2.5 text-[11px] font-medium group-data-[collapsible=icon]:pointer-events-none">
              {group.label}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {group.items.map((item) => (
                <NavItem
                  key={item.id}
                  item={item}
                  isItemActive={isItemActive}
                  isSubItemActive={isSubItemActive}
                  isSubmenuOpen={isSubmenuOpen}
                  onNavigate={onNavigate}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}

function NavItem({ item, isItemActive, isSubItemActive, isSubmenuOpen, onNavigate }: NavItemProps) {
  const { state, isMobile } = useSidebar();
  const isCollapsedDesktop = state === "collapsed" && !isMobile;

  if (!hasSubItems(item)) {
    return (
      <NavLinkItem
        item={item}
        isActive={isItemActive(item)}
        showIconFallback={isCollapsedDesktop}
        onNavigate={onNavigate}
      />
    );
  }

  if (isCollapsedDesktop) {
    return (
      <NavDropdownItem
        item={item}
        isActive={isItemActive(item)}
        isSubItemActive={isSubItemActive}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <NavCollapsibleItem
      item={item}
      isActive={isItemActive(item)}
      defaultOpen={isSubmenuOpen(item)}
      isSubItemActive={isSubItemActive}
      onNavigate={onNavigate}
    />
  );
}

function NavLinkItem({ item, isActive, showIconFallback, onNavigate }: NavLinkItemProps) {
  const contenido = (
    <>
      <NavLinkIcon item={item} showFallback={showIconFallback} />
      <span className="truncate">{item.title}</span>
      <IndicadorEnlace />
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

function NavLinkIcon({ item, showFallback }: NavLinkIconProps) {
  const Icon = item.icon;

  if (Icon) {
    return <Icon />;
  }

  if (showFallback) {
    return <CollapsedIconFallback title={item.title} />;
  }

  return null;
}

function NavDropdownItem({ item, isActive, isSubItemActive, onNavigate }: NavDropdownItemProps) {
  const Icon = item.icon;

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <SidebarMenuButton
              tooltip={item.title}
              isActive={isActive}
              disabled={item.disabled}
              className={estiloItem}
            />
          }
        >
          {Icon ? <Icon /> : <CollapsedIconFallback title={item.title} />}
          <span className="truncate">{item.title}</span>
        </DropdownMenuTrigger>

        <DropdownMenuContent side="right" align="start" sideOffset={12} className="w-48">
          <DropdownMenuGroup>
            {item.subItems.map((subItem) => {
              const SubIcon = subItem.icon;

              return (
                <DropdownMenuItem
                  key={subItem.id}
                  render={
                    <Link
                      href={subItem.url}
                      target={subItem.newTab ? "_blank" : undefined}
                      rel={subItem.newTab ? "noreferrer" : undefined}
                      aria-current={isSubItemActive(subItem.url) ? "page" : undefined}
                      className="flex items-center gap-2"
                      onClick={() => onNavigate(subItem.url)}
                    />
                  }
                  disabled={subItem.disabled}
                >
                  {SubIcon && <SubIcon />}
                  <span className="truncate">{subItem.title}</span>
                  <IndicadorEnlace />
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}

function NavCollapsibleItem({ item, isActive, defaultOpen, isSubItemActive, onNavigate }: NavCollapsibleItemProps) {
  const Icon = item.icon;

  return (
    <Collapsible
      render={<li data-slot="sidebar-menu-item" data-sidebar="menu-item" className="group/menu-item relative" />}
      defaultOpen={defaultOpen}
      className="group/collapsible"
    >
      <CollapsibleTrigger
        render={
          <SidebarMenuButton tooltip={item.title} isActive={isActive} disabled={item.disabled} className={estiloItem} />
        }
      >
        {Icon && <Icon />}
        <span className="truncate">{item.title}</span>
        <ChevronRight className="ml-auto size-4! opacity-60 transition-transform duration-200 group-data-panel-open/menu-button:rotate-90" />
      </CollapsibleTrigger>
      <NavItemBadge badge={item.badge} />

      <CollapsibleContent>
        <SidebarMenuSub className="mx-0 gap-0.5 border-0 px-0 py-0.5">
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
                      onClick={() => onNavigate(subItem.url)}
                    />
                  }
                  aria-disabled={subItem.disabled}
                  isActive={isSubItemActive(subItem.url)}
                  className={estiloSubItem}
                >
                  {SubIcon && <SubIcon />}
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
        "rounded-sm border px-1.5 capitalize",
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
