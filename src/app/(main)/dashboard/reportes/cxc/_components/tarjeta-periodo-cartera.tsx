import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { VistaAntiguedad } from "@/lib/reportes/administrativos/d/tipos";

import { SelectorPeriodoCartera } from "./selector-periodo-cartera";

interface Props {
  desde: string;
  hasta: string;
  vista: VistaAntiguedad;
  ncf: string;
  contacto: string;
  creacionDesde: string | null;
  creacionHasta: string | null;
  vencimientoDesde: string | null;
  vencimientoHasta: string | null;
}

export function TarjetaPeriodoCartera({
  desde,
  hasta,
  vista,
  ncf,
  contacto,
  creacionDesde,
  creacionHasta,
  vencimientoDesde,
  vencimientoHasta,
}: Props) {
  const ocultos: readonly (readonly [string, string | null])[] = [
    ["vista", vista === "todas" ? null : vista],
    ["ncf", ncf || null],
    ["contacto", contacto || null],
    ["creacion_desde", creacionDesde],
    ["creacion_hasta", creacionHasta],
    ["vencimiento_desde", vencimientoDesde],
    ["vencimiento_hasta", vencimientoHasta],
  ];

  return (
    <section className="border-border bg-card rounded-xl border px-5 py-4 print:hidden">
      <form method="get" className="flex flex-wrap items-end justify-between gap-4">
        {ocultos.map(([nombre, valor]) =>
          valor ? <input key={nombre} type="hidden" name={nombre} value={valor} /> : null,
        )}

        <div className="flex w-full max-w-72 flex-col gap-1.5 sm:w-auto sm:min-w-64">
          <Label className="text-sm font-medium text-slate-700">
            Periodo <span className="text-rose-600">*</span>
          </Label>
          <SelectorPeriodoCartera desde={desde} hasta={hasta} />
        </div>

        <Button type="submit" size="lg" className="h-9 rounded-md px-5">
          Generar Reporte
        </Button>
      </form>
    </section>
  );
}
