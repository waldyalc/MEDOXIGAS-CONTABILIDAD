import { Card, CardContent } from "@/components/ui/card";

export interface TarjetaResumen {
  titulo: string;
  valor: string;
}

export function TarjetasResumen({ tarjetas, columnas = 4 }: { tarjetas: readonly TarjetaResumen[]; columnas?: 4 | 5 }) {
  return (
    <div className={`grid gap-3 sm:grid-cols-2 ${columnas === 5 ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>
      {tarjetas.map((tarjeta) => (
        <Card key={tarjeta.titulo} className="py-0">
          <CardContent className="flex flex-col gap-1 p-4">
            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{tarjeta.titulo}</span>
            <span className="text-lg font-semibold tabular-nums">{tarjeta.valor}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
