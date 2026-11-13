import { Factory, FileText, type LucideIcon, ShoppingCart, Wallet } from "lucide-react";

import type { Rol } from "@/lib/auth/rol";

export type NavBadge = "new" | "updated" | "soon";

export interface NavSubItem {
  id: string;
  title: string;
  url: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
}

interface NavItemBase {
  id: string;
  title: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
  roles: Rol[];
}

export interface NavMainLinkItem extends NavItemBase {
  url: string;
  subItems?: never;
}

export interface NavMainParentItem extends NavItemBase {
  subItems: NavSubItem[];
}

export type NavMainItem = NavMainLinkItem | NavMainParentItem;

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
}

export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "Módulos",
    items: [
      {
        id: "produccion",
        title: "Producción",
        url: "/dashboard/produccion",
        icon: Factory,
        roles: ["admin"],
      },
      {
        id: "estado-cuenta",
        title: "Estado de cuenta",
        url: "/dashboard/estado-cuenta",
        icon: FileText,
        roles: ["admin", "cobros"],
      },
      {
        id: "caja-chica",
        title: "Caja Chica",
        url: "/dashboard/caja-chica",
        icon: Wallet,
        roles: ["admin", "caja"],
      },
      {
        id: "pos",
        title: "Punto de Venta",
        url: "/pos",
        icon: ShoppingCart,
        newTab: true,
        roles: ["admin", "caja"],
      },
    ],
  },
];

export function filtrarItemsPorRol(rol: Rol | null): NavGroup[] {
  if (rol == null) return [];

  return sidebarItems
    .map((grupo) => ({ ...grupo, items: grupo.items.filter((item) => item.roles.includes(rol)) }))
    .filter((grupo) => grupo.items.length > 0);
}
