import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  desde: string;
  hasta: string;
}

export function FiltroFechas({ desde, hasta }: Props) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3 print:hidden">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="desde">Desde</Label>
        <Input id="desde" name="desde" type="date" defaultValue={desde} className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hasta">Hasta</Label>
        <Input id="hasta" name="hasta" type="date" defaultValue={hasta} className="w-40" />
      </div>
      <Button type="submit" variant="secondary">
        Aplicar
      </Button>
    </form>
  );
}
