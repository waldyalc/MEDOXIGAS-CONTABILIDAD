import Link from "next/link";
import { redirect } from "next/navigation";

import { BookOpen, Building2, CalendarClock, Hash, type LucideIcon, Percent, Users } from "lucide-react";

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
        {
          id: "terminos-pago",
          titulo: "Términos de pago",
          descripcion: "Plazos disponibles para las facturas de venta.",
          url: "/dashboard/configuracion/terminos-pago",
          icon: CalendarClock,
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
          descripcion: "Tasas de ITBIS disponibles en productos y facturas.",
          url: "/dashboard/configuracion/impuestos",
          icon: Percent,
        },
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
      ],
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl tracking-tight">Configuración</h1>
        <p className="text-muted-foreground text-balance">
          Datos de la empresa, facturación, impuestos y cuentas por defecto.
        </p>
      </div>

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
