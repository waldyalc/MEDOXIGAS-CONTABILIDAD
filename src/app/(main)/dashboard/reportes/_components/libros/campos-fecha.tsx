import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  desde: string;
  hasta: string;
}

export function CamposFecha({ desde, hasta }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="desde">Desde</Label>
        <Input id="desde" name="desde" type="date" defaultValue={desde} className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hasta">Hasta</Label>
        <Input id="hasta" name="hasta" type="date" defaultValue={hasta} className="w-40" />
      </div>
    </div>
  );
}
