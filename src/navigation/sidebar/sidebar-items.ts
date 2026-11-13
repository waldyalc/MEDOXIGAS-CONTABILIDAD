import {
  BookOpen,
  Boxes,
  ChartColumn,
  Contact,
  House,
  Landmark,
  type LucideIcon,
  Package,
  ReceiptText,
  ShoppingCart,
} from "lucide-react";

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
        id: "ingresos",
        title: "Ingresos",
        icon: ReceiptText,
        roles: TODOS_LOS_ROLES,
        subItems: [
          {
            id: "facturas-venta",
            title: "Facturas de venta",
            url: "/dashboard/facturacion",
          },
          {
            id: "pagos-recibidos",
            title: "Pagos recibidos",
            url: "/dashboard/pagos-recibidos",
          },
          {
            id: "cotizaciones",
            title: "Cotizaciones",
            url: "/dashboard/cotizaciones",
          },
          {
            id: "conduces",
            title: "Conduces",
            url: "/dashboard/conduces",
          },
          {
            id: "notas-credito",
            title: "Notas de crédito",
            url: "/dashboard/notas-credito",
          },
          {
            id: "notas-debito",
            title: "Notas de débito",
            url: "/dashboard/notas-debito",
          },
          {
            id: "facturas-recurrentes",
            title: "Facturas recurrentes",
            url: "/dashboard/facturas-recurrentes",
          },
        ],
      },
      {
        id: "compras",
        title: "Compras",
        icon: ShoppingCart,
        roles: TODOS_LOS_ROLES,
        subItems: [
          {
            id: "facturas-proveedor",
            title: "Facturas de proveedor",
            url: "/dashboard/compras",
          },
          {
            id: "pagos-proveedores",
            title: "Pagos a proveedores",
            url: "/dashboard/compras/pagos",
          },
          {
            id: "gastos-menores",
            title: "Gastos menores",
            url: "/dashboard/gastos",
          },
          {
            id: "notas-credito-compras",
            title: "Notas de crédito en compras",
            url: "/dashboard/compras/notas-credito",
          },
          {
            id: "ordenes-compra",
            title: "Órdenes de compra",
            url: "/dashboard/ordenes-compra",
          },
          {
            id: "pagos-recurrentes",
            title: "Pagos recurrentes",
            url: "/dashboard/pagos-recurrentes",
          },
        ],
      },
      {
        id: "contactos",
        title: "Contactos",
        url: "/dashboard/contactos",
        icon: Contact,
        roles: TODOS_LOS_ROLES,
      },
      {
        id: "productos",
        title: "Productos",
        url: "/dashboard/productos",
        icon: Package,
        roles: TODOS_LOS_ROLES,
      },
      {
        id: "inventario",
        title: "Inventario",
        icon: Boxes,
        roles: TODOS_LOS_ROLES,
        subItems: [
          {
            id: "ajustes-inventario",
            title: "Ajustes de inventario",
            url: "/dashboard/inventario/ajustes",
          },
          {
            id: "almacenes",
            title: "Almacenes",
            url: "/dashboard/inventario/almacenes",
          },
          {
            id: "categorias-productos",
            title: "Categorías",
            url: "/dashboard/inventario/categorias",
          },
        ],
      },
      {
        id: "contabilidad",
        title: "Contabilidad",
        icon: BookOpen,
        roles: TODOS_LOS_ROLES,
        subItems: [
          {
            id: "catalogo-cuentas",
            title: "Catálogo de cuentas",
            url: "/dashboard/contabilidad",
          },
          {
            id: "asientos",
            title: "Asientos",
            url: "/dashboard/contabilidad/asientos",
          },
          {
            id: "numeraciones",
            title: "Numeraciones",
            url: "/dashboard/contabilidad/numeraciones",
          },
          {
            id: "activos-fijos",
            title: "Activos fijos",
            url: "/dashboard/contabilidad/activos",
          },
          {
            id: "periodos",
            title: "Periodos",
            url: "/dashboard/contabilidad/periodos",
          },
        ],
      },
      {
        id: "bancos",
        title: "Bancos",
        url: "/dashboard/bancos",
        icon: Landmark,
        roles: TODOS_LOS_ROLES,
      },
      {
        id: "reportes",
        title: "Reportes",
        url: "/dashboard/reportes",
        icon: ChartColumn,
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
