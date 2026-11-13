import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { VistaAntiguedad } from "@/lib/reportes/administrativos/d/tipos";

import { SelectorFechaCorte, SelectorFechaFormulario, SelectorRangoFechas } from "../../_components/selector-fechas";

interface Props {
  tipo: "cobrar" | "pagar";
  desde: string | null;
  hasta: string;
  vista: VistaAntiguedad;
  ncf: string;
  contacto: string;
  creacionDesde: string | null;
  creacionHasta: string | null;
  vencimientoDesde: string | null;
  vencimientoHasta: string | null;
}

export function FiltrosCartera({
  tipo,
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
  return (
    <form method="get" className="flex flex-col gap-3 print:hidden">
      {vista !== "todas" ? <input type="hidden" name="vista" value={vista} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label>{desde == null ? "Fecha de corte" : "Período"}</Label>
          {desde == null ? <SelectorFechaCorte valor={hasta} /> : <SelectorRangoFechas desde={desde} hasta={hasta} />}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ncf">NCF/Número</Label>
          <Input id="ncf" name="ncf" defaultValue={ncf} placeholder="B0100000001" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contacto">{tipo === "cobrar" ? "Cliente" : "Proveedor"}</Label>
          <Input id="contacto" name="contacto" defaultValue={contacto} placeholder="Nombre del contacto" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Creación desde</Label>
          <SelectorFechaFormulario name="creacion_desde" valor={creacionDesde ?? ""} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Creación hasta</Label>
          <SelectorFechaFormulario name="creacion_hasta" valor={creacionHasta ?? ""} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Vencimiento desde</Label>
          <SelectorFechaFormulario name="vencimiento_desde" valor={vencimientoDesde ?? ""} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Vencimiento hasta</Label>
          <SelectorFechaFormulario name="vencimiento_hasta" valor={vencimientoHasta ?? ""} />
        </div>
      </div>

      <div>
        <Button type="submit" variant="secondary">
          Aplicar
        </Button>
      </div>
    </form>
  );
}
