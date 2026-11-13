import Link from "next/link";

import {
  ArrowUpRight,
  BookOpen,
  ClipboardList,
  Landmark,
  type LucideIcon,
  Search,
  ShoppingCart,
  Wallet,
  Wrench,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type CategoriaReporte,
  filtrarReportes,
  REPORTES,
  reportesPorCategoria,
} from "@/lib/reportes/catalogo-reportes";

import { AvisoSaldoNegativo } from "./_components/aviso-saldo-negativo";

const ICONOS: Record<CategoriaReporte, LucideIcon> = {
  Ventas: ShoppingCart,
  Administrativos: ClipboardList,
  Financieros: Wallet,
  Contables: BookOpen,
  Fiscales: Landmark,
  "Para trabajar": Wrench,
};

const ENLACES_FISCALES: Record<string, string> = {
  "Reporte 606": "/dashboard/reportes/606",
  "Reporte 607": "/dashboard/reportes/607",
  "Reporte 608": "/dashboard/reportes/608",
  "Reporte IT1": "/dashboard/reportes/it1",
  "Reporte detallado de impuestos": "/dashboard/reportes/impuestos-detallados",
  "Impuestos y retenciones": "/dashboard/reportes/impuestos-retenciones",
  "Reporte IR-17": "/dashboard/reportes/ir-17",
  "Cartas de retención": "/dashboard/reportes/cartas-retencion",
  "Exportar facturas": "/dashboard/reportes/exportar-contador",
  "Informe contador": "/dashboard/reportes/exportar-contador",
};

function conEnlacesFiscales(reportes: typeof REPORTES) {
  return reportes.map((reporte) => {
    const href = ENLACES_FISCALES[reporte.nombre];
    return href == null ? reporte : { ...reporte, href };
  });
}

interface Props {
  searchParams: Promise<{ q?: string | string[] }>;
}

export default async function Page({ searchParams }: Props) {
  const parametros = await searchParams;
  const busqueda = (Array.isArray(parametros.q) ? parametros.q[0] : parametros.q) ?? "";
  const grupos = reportesPorCategoria(filtrarReportes(busqueda, conEnlacesFiscales(REPORTES)));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl tracking-tight">Reportes</h1>
        <p className="text-muted-foreground text-balance">
          La contabilidad se genera sola a partir de las facturas, pagos y gastos. Elige un reporte para verlo o
          descargarlo.
        </p>
      </div>

      <AvisoSaldoNegativo />

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-64 flex-1 flex-col gap-1.5">
          <Label htmlFor="q">Buscar reporte</Label>
          <Input
            id="q"
            name="q"
            type="search"
            defaultValue={busqueda}
            placeholder="Ej. estado de resultados, 606, cuentas por cobrar…"
          />
        </div>
        <Button type="submit" variant="secondary">
          <Search />
          Buscar
        </Button>
      </form>

      {grupos.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No hay reportes que coincidan con «{busqueda}». Prueba con otro nombre.
        </p>
      ) : (
        grupos.map((grupo) => {
          const Icono = ICONOS[grupo.categoria];

          return (
            <section key={grupo.categoria} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Icono className="text-muted-foreground size-4" />
                <h2 className="text-lg font-semibold tracking-tight">{grupo.categoria}</h2>
                <Badge variant="outline">{grupo.reportes.length}</Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {grupo.reportes.map((reporte) =>
                  reporte.href ? (
                    <Link key={reporte.nombre} href={reporte.href} className="group">
                      <Card className="group-hover:bg-muted/50 h-full py-0 transition-colors">
                        <CardContent className="flex items-center justify-between gap-3 p-4">
                          <span className="font-medium">{reporte.nombre}</span>
                          <ArrowUpRight className="text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </CardContent>
                      </Card>
                    </Link>
                  ) : (
                    <Card key={reporte.nombre} className="bg-muted/30 h-full py-0 opacity-75">
                      <CardContent className="flex items-center justify-between gap-3 p-4">
                        <span className="text-muted-foreground font-medium">{reporte.nombre}</span>
                        <Badge variant="secondary">Próximamente</Badge>
                      </CardContent>
                    </Card>
                  ),
                )}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
