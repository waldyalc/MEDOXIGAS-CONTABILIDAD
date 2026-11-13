import { TarjetaTotal } from "../../cxc/_components/tarjeta-total";

interface Props {
  antesDeImpuestos: number;
  despuesDeImpuestos: number;
}

export function TotalesCompras({ antesDeImpuestos, despuesDeImpuestos }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TarjetaTotal etiqueta="Antes de impuestos" total={antesDeImpuestos} />
      <TarjetaTotal etiqueta="Después de impuestos" total={despuesDeImpuestos} />
    </div>
  );
}
