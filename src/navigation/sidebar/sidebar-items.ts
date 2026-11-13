import { Banknote, ChartColumn, House, Landmark, type LucideIcon, Package, ReceiptText, Users } from "lucide-react";

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

const TODOS_LOS_ROLES: Rol[] = ["admin", "contador", "lector"];

export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "Módulos",
    items: [
      {
        id: "inicio",
        title: "Inicio",
        url: "/dashboard",
        icon: House,
        roles: TODOS_LOS_ROLES,
      },
      {
        id: "facturacion",
        title: "Facturación",
        url: "/dashboard/facturacion",
        icon: ReceiptText,
        badge: "soon",
        disabled: true,
        roles: TODOS_LOS_ROLES,
      },
      {
        id: "clientes",
        title: "Clientes",
        url: "/dashboard/clientes",
        icon: Users,
        badge: "soon",
        disabled: true,
        roles: TODOS_LOS_ROLES,
      },
      {
        id: "productos",
        title: "Productos",
        url: "/dashboard/productos",
        icon: Package,
        badge: "soon",
        disabled: true,
        roles: TODOS_LOS_ROLES,
      },
      {
        id: "gastos",
        title: "Gastos",
        url: "/dashboard/gastos",
        icon: Banknote,
        badge: "soon",
        disabled: true,
        roles: TODOS_LOS_ROLES,
      },
      {
        id: "bancos",
        title: "Bancos",
        url: "/dashboard/bancos",
        icon: Landmark,
        badge: "soon",
        disabled: true,
        roles: TODOS_LOS_ROLES,
      },
      {
        id: "reportes",
        title: "Reportes",
        url: "/dashboard/reportes",
        icon: ChartColumn,
        badge: "soon",
        disabled: true,
        roles: TODOS_LOS_ROLES,
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
