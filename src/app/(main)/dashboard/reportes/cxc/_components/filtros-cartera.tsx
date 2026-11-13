import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { VistaAntiguedad } from "@/lib/reportes/administrativos/d/tipos";

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
        {desde == null ? null : (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="desde">Desde</Label>
            <Input id="desde" name="desde" type="date" defaultValue={desde} />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hasta">Hasta</Label>
          <Input id="hasta" name="hasta" type="date" defaultValue={hasta} required />
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
          <Label htmlFor="creacion_desde">Creación desde</Label>
          <Input id="creacion_desde" name="creacion_desde" type="date" defaultValue={creacionDesde ?? ""} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="creacion_hasta">Creación hasta</Label>
          <Input id="creacion_hasta" name="creacion_hasta" type="date" defaultValue={creacionHasta ?? ""} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="vencimiento_desde">Vencimiento desde</Label>
          <Input id="vencimiento_desde" name="vencimiento_desde" type="date" defaultValue={vencimientoDesde ?? ""} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="vencimiento_hasta">Vencimiento hasta</Label>
          <Input id="vencimiento_hasta" name="vencimiento_hasta" type="date" defaultValue={vencimientoHasta ?? ""} />
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
