import { Card, CardContent } from "@/components/ui/card";
import { formatearRd } from "@/lib/reportes/dinero";
import type { TotalesVentas } from "@/lib/reportes/ventas/v1/tipos";

interface Props {
  totales: TotalesVentas;
}

export function TarjetasVentas({ totales }: Props) {
  const tarjetas = [
    { titulo: "Ventas brutas", valor: totales.ventasBrutas },
    { titulo: "Notas crédito", valor: totales.notasCredito },
    { titulo: "Antes de impuestos", valor: totales.antesImpuestos },
    { titulo: "Impuestos", valor: totales.impuestos },
    { titulo: "Después de impuestos", valor: totales.despuesImpuestos },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {tarjetas.map((tarjeta) => (
        <Card key={tarjeta.titulo} className="py-0">
          <CardContent className="flex flex-col gap-1 p-4">
            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{tarjeta.titulo}</span>
            <span className="text-lg font-semibold tabular-nums">{formatearRd(tarjeta.valor)}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
