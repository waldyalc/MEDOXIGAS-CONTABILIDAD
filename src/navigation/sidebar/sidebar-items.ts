import {
  Bank,
  Calculator,
  ChartLine,
  CheckSquare,
  FileText,
  Gear,
  House,
  IdentificationCard,
  Inbox,
  type LucideIcon,
  Package,
  Receipt,
  ShoppingCart,
  Storefront,
  Users,
} from "@/components/icons";
import type { Rol } from "@/lib/auth/rol";

export type NavBadge = "new" | "updated" | "soon";

export interface NavSubItem {
  id: string;
  title: string;
  url: string;
  icon?: LucideIcon;
  /** Ruta de creación: el botón «+» que Alegra muestra al pasar el mouse. */
  addUrl?: string;
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
  separadorDespues?: boolean;
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
    items: [
      {
        id: "inicio",
        title: "Inicio",
        url: "/dashboard",
        icon: House,
        roles: TODOS_LOS_ROLES,
      },
      {
        id: "bandeja-entrada",
        title: "Bandeja de entrada",
        url: "/dashboard",
        icon: Inbox,
        separadorDespues: true,
        roles: TODOS_LOS_ROLES,
      },
      {
        id: "ingresos",
        title: "Ingresos",
        icon: Receipt,
        roles: TODOS_LOS_ROLES,
        subItems: [
          {
            id: "facturas-venta",
            title: "Facturas de venta",
            url: "/dashboard/facturacion",
            addUrl: "/dashboard/facturacion/nueva",
          },
          {
            id: "facturas-recurrentes",
            title: "Facturas de venta recurrentes",
            url: "/dashboard/facturas-recurrentes",
            addUrl: "/dashboard/facturas-recurrentes/nueva",
          },
          {
            id: "pagos-recibidos",
            title: "Pagos recibidos",
            url: "/dashboard/pagos-recibidos",
            addUrl: "/dashboard/pagos-recibidos/nuevo",
          },
          {
            id: "notas-credito",
            title: "Notas de crédito",
            url: "/dashboard/notas-credito",
            addUrl: "/dashboard/notas-credito/nueva",
          },
          {
            id: "notas-debito",
            title: "Notas de débito",
            url: "/dashboard/notas-debito",
            addUrl: "/dashboard/notas-debito/nueva",
          },
          {
            id: "cotizaciones",
            title: "Cotizaciones",
            url: "/dashboard/cotizaciones",
            addUrl: "/dashboard/cotizaciones/nueva",
          },
          {
            id: "conduces",
            title: "Conduces",
            url: "/dashboard/conduces",
            addUrl: "/dashboard/conduces/nueva",
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
            title: "Facturas de proveedores",
            url: "/dashboard/compras",
            addUrl: "/dashboard/compras/nueva",
          },
          {
            id: "pagos-proveedores",
            title: "Pagos / Gastos",
            url: "/dashboard/compras/pagos",
            addUrl: "/dashboard/compras/pagos/nuevo",
          },
          {
            id: "gastos-menores",
            title: "Gastos menores",
            url: "/dashboard/gastos",
            addUrl: "/dashboard/gastos/nuevo",
          },
          {
            id: "pagos-recurrentes",
            title: "Pagos recurrentes",
            url: "/dashboard/pagos-recurrentes",
            addUrl: "/dashboard/pagos-recurrentes/nueva",
          },
          {
            id: "notas-credito-compras",
            title: "Notas de crédito en compras",
            url: "/dashboard/compras/notas-credito",
            addUrl: "/dashboard/compras/notas-credito/nueva",
          },
          {
            id: "ordenes-compra",
            title: "Órdenes de compra",
            url: "/dashboard/ordenes-compra",
            addUrl: "/dashboard/ordenes-compra/nueva",
          },
        ],
      },
      {
        id: "contactos",
        title: "Contactos",
        url: "/dashboard/contactos",
        icon: Users,
        roles: TODOS_LOS_ROLES,
      },
      {
        id: "inventario",
        title: "Inventario",
        icon: Package,
        roles: TODOS_LOS_ROLES,
        subItems: [
          {
            id: "productos",
            title: "Productos y servicios",
            url: "/dashboard/productos",
            addUrl: "/dashboard/productos/nuevo",
          },
          {
            id: "valor-inventario",
            title: "Valor de inventario",
            url: "/dashboard/reportes/valor-inventario",
          },
          {
            id: "ajustes-inventario",
            title: "Ajustes de inventario",
            url: "/dashboard/inventario/ajustes",
            addUrl: "/dashboard/inventario/ajustes/nuevo",
          },
          {
            id: "transferencias-inventario",
            title: "Transferencias",
            url: "/dashboard/inventario/transferencias",
            addUrl: "/dashboard/inventario/transferencias/nueva",
          },
          {
            id: "listas-precios",
            title: "Listas de precios",
            url: "/dashboard/inventario/listas-precios",
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
        id: "bancos",
        title: "Bancos",
        icon: Bank,
        roles: TODOS_LOS_ROLES,
        subItems: [
          {
            id: "bancos-cuentas",
            title: "Bancos y cajas",
            url: "/dashboard/bancos",
          },
          {
            id: "bancos-conciliaciones",
            title: "Conciliaciones bancarias",
            url: "/dashboard/bancos/conciliaciones",
          },
        ],
      },
      {
        id: "contabilidad",
        title: "Contabilidad",
        icon: Calculator,
        roles: TODOS_LOS_ROLES,
        subItems: [
          {
            id: "catalogo-cuentas",
            title: "Catálogo de cuentas",
            url: "/dashboard/contabilidad",
          },
          {
            id: "asientos",
            title: "Entrada de diario",
            url: "/dashboard/contabilidad/asientos",
            addUrl: "/dashboard/contabilidad/asientos/nuevo",
          },
          {
            id: "libro-diario",
            title: "Libro diario",
            url: "/dashboard/reportes/libro-diario",
          },
          {
            id: "numeraciones",
            title: "Numeraciones",
            url: "/dashboard/contabilidad/numeraciones",
          },
          {
            id: "activos-fijos",
            title: "Activos",
            url: "/dashboard/contabilidad/activos",
            addUrl: "/dashboard/contabilidad/activos/nuevo",
          },
          {
            id: "periodos",
            title: "Periodos",
            url: "/dashboard/contabilidad/periodos",
          },
        ],
      },
      {
        id: "reportes",
        title: "Reportes",
        url: "/dashboard/reportes",
        icon: ChartLine,
        roles: TODOS_LOS_ROLES,
      },
      {
        id: "mis-tareas",
        title: "Mis tareas",
        url: "/dashboard",
        icon: CheckSquare,
        roles: TODOS_LOS_ROLES,
      },
      {
        id: "configuracion",
        title: "Configuración",
        url: "/dashboard/configuracion",
        icon: Gear,
        roles: TODOS_LOS_ROLES,
      },
      {
        id: "configuracion-reportes-dgii",
        title: "Reportes DGII",
        url: "/dashboard/configuracion/reportes-dgii",
        icon: FileText,
        roles: ["admin", "contador"],
      },
    ],
  },
  {
    id: 2,
    label: "Descubre más soluciones",
    items: [
      {
        id: "nomina",
        title: "Nómina",
        icon: IdentificationCard,
        roles: TODOS_LOS_ROLES,
        subItems: [
          {
            id: "nomina-inicio",
            title: "Inicio",
            url: "/dashboard/contabilidad/nomina",
          },
          {
            id: "nomina-empleados",
            title: "Empleados",
            url: "/dashboard/contabilidad/nomina/empleados",
          },
          {
            id: "nomina-calculo",
            title: "Cálculo de nómina",
            url: "/dashboard/contabilidad/nomina/periodos",
          },
          {
            id: "nomina-pagos",
            title: "Pagos",
            url: "/dashboard/contabilidad/nomina/pagos",
          },
          {
            id: "nomina-envios",
            title: "Gestión de envíos",
            url: "/dashboard/contabilidad/nomina/envios",
          },
          {
            id: "nomina-reportes",
            title: "Reportes TSS",
            url: "/dashboard/contabilidad/nomina/reportes",
          },
        ],
      },
      {
        id: "punto-venta",
        title: "POS",
        url: "/pos",
        icon: Storefront,
        newTab: true,
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
