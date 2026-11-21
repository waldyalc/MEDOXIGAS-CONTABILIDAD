import type { ReactNode } from "react";

import { cn } from "cn";
import { OctagonAlert, PackageX, TrendingDown } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

import type { ResumenStock } from "../_lib/stock-bajo";

function TarjetaResumen({
  etiqueta,
  descripcion,
  valor,
  icono,
  clasesIcono,
}: {
  etiqueta: string;
  descripcion: string;
  valor: number;
  icono: ReactNode;
  clasesIcono: string;
}) {
  return (
    <Card className="py-0">
      <CardContent className="flex items-center gap-3 p-4">
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", clasesIcono)}>{icono}</span>
        <div className="flex min-w-0 flex-col">
          <p className="text-muted-foreground text-xs">{etiqueta}</p>
          <p className="text-2xl font-semibold tabular-nums">{valor}</p>
          <p className="text-muted-foreground truncate text-xs">{descripcion}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function TarjetasStockBajo({ resumen }: { resumen: ResumenStock }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <TarjetaResumen
        etiqueta="Críticos"
        descripcion="Existencia negativa"
        valor={resumen.criticos}
        icono={<OctagonAlert className="size-5" />}
        clasesIcono="bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400"
      />
      <TarjetaResumen
        etiqueta="Bajo mínimo"
        descripcion="Existencia positiva bajo el mínimo"
        valor={resumen.bajoMinimo}
        icono={<TrendingDown className="size-5" />}
        clasesIcono="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
      />
      <TarjetaResumen
        etiqueta="Sin stock"
        descripcion="Existencia en cero"
        valor={resumen.sinStock}
        icono={<PackageX className="size-5" />}
        clasesIcono="bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300"
      />
    </div>
  );
}
