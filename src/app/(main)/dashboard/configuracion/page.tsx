import Link from "next/link";
import { redirect } from "next/navigation";

import {
  BookOpen,
  Building2,
  CalendarClock,
  Coins,
  FileSpreadsheet,
  Hash,
  ListTree,
  type LucideIcon,
  MapPin,
  NotebookText,
  Percent,
  Printer,
  ReceiptText,
  Scale,
  ShieldCheck,
  Store,
  UserRound,
  Users,
} from "@/components/icons";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getRol } from "@/lib/auth/rol";

interface TarjetaConfiguracion {
  id: string;
  titulo: string;
  descripcion: string;
  url: string;
  icon: LucideIcon;
}

interface GrupoConfiguracion {
  id: string;
  titulo: string;
  tarjetas: TarjetaConfiguracion[];
}

export default async function Page() {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const grupos: GrupoConfiguracion[] = [
    {
      id: "empresa",
      titulo: "Empresa",
      tarjetas: [
        {
          id: "datos-empresa",
          titulo: "Empresa",
          descripcion: "Nombre, RNC, dirección, teléfono, correo y logo.",
          url: "/dashboard/configuracion/empresa",
          icon: Building2,
        },
        {
          id: "centros-costo",
          titulo: "Centros de costo",
          descripcion: "Áreas o sucursales para separar ingresos y gastos.",
          url: "/dashboard/configuracion/centros-costo",
          icon: MapPin,
        },
        {
          id: "monedas",
          titulo: "Monedas",
          descripcion: "Moneda base y tasas de cambio por fecha.",
          url: "/dashboard/configuracion/monedas",
          icon: Coins,
        },
        ...(rol === "admin"
          ? [
              {
                id: "usuarios",
                titulo: "Usuarios",
                descripcion: "Personas con acceso y su rol en la contabilidad.",
                url: "/dashboard/configuracion/usuarios",
                icon: Users,
              },
            ]
          : []),
      ],
    },
    {
      id: "facturacion",
      titulo: "Facturación",
      tarjetas: [
        ...(rol === "admin" || rol === "contador"
          ? [
              {
                id: "facturacion-electronica",
                titulo: "Facturación electrónica",
                descripcion:
                  "Habilitación e-CF ante la DGII, certificado digital, pruebas de simulación y migración desde Alegra.",
                url: "/dashboard/configuracion/facturacion-electronica",
                icon: ShieldCheck,
              },
            ]
          : []),
        {
          id: "punto-venta",
          titulo: "Punto de venta",
          descripcion: "Terminales de caja: almacén, cuentas por método y plantilla del ticket.",
          url: "/dashboard/configuracion/pos",
          icon: Store,
        },
        {
          id: "terminos-pago",
          titulo: "Términos de pago",
          descripcion: "Plazos disponibles para las facturas de venta.",
          url: "/dashboard/configuracion/terminos-pago",
          icon: CalendarClock,
        },
        {
          id: "vendedores",
          titulo: "Vendedores",
          descripcion: "Personas que venden y se eligen en los documentos.",
          url: "/dashboard/configuracion/vendedores",
          icon: UserRound,
        },
        {
          id: "plantillas-impresion",
          titulo: "Plantillas de impresión",
          descripcion: "Notas al pie, términos y logo por tipo de documento.",
          url: "/dashboard/configuracion/plantillas-impresion",
          icon: Printer,
        },
        {
          id: "numeraciones",
          titulo: "Numeraciones",
          descripcion: "Secuencias del NCF por tipo de comprobante.",
          url: "/dashboard/contabilidad/numeraciones",
          icon: Hash,
        },
      ],
    },
    {
      id: "impuestos",
      titulo: "Impuestos",
      tarjetas: [
        {
          id: "impuestos-itbis",
          titulo: "Impuestos",
          descripcion: "Catálogo de ITBIS, CDT, propina y exento.",
          url: "/dashboard/configuracion/impuestos",
          icon: Percent,
        },
        {
          id: "retenciones",
          titulo: "Retenciones",
          descripcion: "Retenciones de ITBIS e ISR para los pagos.",
          url: "/dashboard/configuracion/retenciones",
          icon: ReceiptText,
        },
        ...(rol === "admin" || rol === "contador"
          ? [
              {
                id: "reportes-dgii",
                titulo: "Reportes DGII",
                descripcion: "Clasificación fiscal por cuenta para los formatos 606 y 607.",
                url: "/dashboard/configuracion/reportes-dgii",
                icon: FileSpreadsheet,
              },
            ]
          : []),
      ],
    },
    {
      id: "contabilidad",
      titulo: "Contabilidad",
      tarjetas: [
        {
          id: "configuraciones-contables",
          titulo: "Configuraciones contables",
          descripcion: "Cuentas por defecto que usa el motor contable.",
          url: "/dashboard/contabilidad",
          icon: BookOpen,
        },
        {
          id: "tipos-entrada-diario",
          titulo: "Tipos de entrada de diario",
          descripcion: "Prefijos y numeraciones de los asientos manuales.",
          url: "/dashboard/configuracion/tipos-entrada-diario",
          icon: NotebookText,
        },
      ],
    },
    {
      id: "nomina",
      titulo: "Nómina",
      tarjetas: [
        {
          id: "nomina-laboral",
          titulo: "Datos laborales y riesgo SRL",
          descripcion: "Riesgo, frecuencia, cuentas y contactos de ley.",
          url: "/dashboard/configuracion/nomina/laboral",
          icon: ShieldCheck,
        },
        {
          id: "nomina-mapeo",
          titulo: "Mapeo contable",
          descripcion: "Cuentas de gasto y pasivo por segmento.",
          url: "/dashboard/configuracion/nomina/mapeo",
          icon: BookOpen,
        },
        {
          id: "nomina-conceptos",
          titulo: "Conceptos",
          descripcion: "Ingresos, deducciones, aportes y provisiones.",
          url: "/dashboard/configuracion/nomina/conceptos",
          icon: ListTree,
        },
        {
          id: "nomina-parametros",
          titulo: "Parámetros legales RD",
          descripcion: "Tasas, topes y escala de ISR por año.",
          url: "/dashboard/configuracion/nomina/parametros",
          icon: Scale,
        },
      ],
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina
        titulo="Configuración"
        subtitulo="Datos de la empresa, facturación, impuestos y cuentas por defecto."
        migas={[{ etiqueta: "Inicio", href: "/dashboard" }, { etiqueta: "Configuración" }]}
      />

      {grupos.map((grupo) => (
        <section key={grupo.id} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">{grupo.titulo}</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {grupo.tarjetas.map((tarjeta) => {
              const Icon = tarjeta.icon;

              return (
                <Link key={tarjeta.id} href={tarjeta.url} prefetch={false} className="group rounded-xl">
                  <Card className="group-hover:bg-accent/50 h-full transition-colors">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-col gap-1">
                          <CardTitle>{tarjeta.titulo}</CardTitle>
                          <CardDescription>{tarjeta.descripcion}</CardDescription>
                        </div>
                        <Icon className="text-muted-foreground mt-0.5 size-5 shrink-0" />
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
