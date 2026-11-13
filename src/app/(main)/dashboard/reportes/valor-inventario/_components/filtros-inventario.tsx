import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

interface Props {
  hasta: string;
  almacen: string;
  producto: string;
  referencia: string;
}

export function FiltrosInventario({ hasta, almacen, producto, referencia }: Props) {
  return (
    <form method="get" className="flex flex-col gap-3 print:hidden">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hasta">Hasta</Label>
          <Input id="hasta" name="hasta" type="date" defaultValue={hasta} required />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="almacen">Almacén</Label>
          <NativeSelect id="almacen" name="almacen" className="w-full" defaultValue={almacen}>
            <NativeSelectOption value="principal">Principal</NativeSelectOption>
          </NativeSelect>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="producto">Producto/servicio</Label>
          <Input id="producto" name="producto" defaultValue={producto} placeholder="Nombre del producto" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="referencia">Referencia</Label>
          <Input id="referencia" name="referencia" defaultValue={referencia} placeholder="Referencia" />
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
