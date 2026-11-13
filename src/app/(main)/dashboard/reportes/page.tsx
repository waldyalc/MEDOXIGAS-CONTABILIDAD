import Link from "next/link";

import { BookOpen, HandCoins, Scale, TrendingUp } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const REPORTES = [
  {
    href: "/dashboard/reportes/libro-diario",
    titulo: "Libro diario",
    descripcion: "Todos los asientos del período con sus débitos y créditos.",
    icon: BookOpen,
  },
  {
    href: "/dashboard/reportes/balance-comprobacion",
    titulo: "Balance de comprobación",
    descripcion: "Débitos, créditos y saldo por cuenta, con verificación de cuadre.",
    icon: Scale,
  },
  {
    href: "/dashboard/reportes/estado-resultados",
    titulo: "Estado de resultados",
    descripcion: "Ingresos, costos y gastos del período, con la utilidad neta.",
    icon: TrendingUp,
  },
  {
    href: "/dashboard/reportes/cxc",
    titulo: "Cuentas por cobrar",
    descripcion: "Saldo pendiente por cliente y días de vencimiento.",
    icon: HandCoins,
  },
];

export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl tracking-tight">Reportes</h1>
        <p className="text-muted-foreground text-balance">
          La contabilidad se genera sola a partir de las facturas, pagos y gastos. Elige un reporte para verlo.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {REPORTES.map((reporte) => {
          const Icon = reporte.icon;

          return (
            <Link key={reporte.href} href={reporte.href} className="group">
              <Card className="group-hover:bg-muted/40 h-full transition-colors">
                <CardHeader className="gap-2">
                  <Icon className="text-primary size-5" />
                  <CardTitle>{reporte.titulo}</CardTitle>
                  <CardDescription>{reporte.descripcion}</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-primary text-sm font-medium">Ver reporte</span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
