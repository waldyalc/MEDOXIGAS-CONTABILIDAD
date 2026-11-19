import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatearRd } from "@/lib/reportes/dinero";

export interface ResumenBancosDatos {
  bancoEfectivoCentavos: number;
  tarjetasCentavos: number;
}

function FilaResumen({ etiqueta, centavos, destacar }: { etiqueta: string; centavos: number; destacar?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs">{etiqueta}</span>
      <span className={destacar ? "text-xl font-semibold tabular-nums" : "text-lg font-semibold tabular-nums"}>
        <MontoResumen centavos={centavos} />
      </span>
    </div>
  );
}

function MontoResumen({ centavos }: { centavos: number }) {
  return <span className={centavos < 0 ? "text-destructive" : ""}>{formatearRd(centavos)}</span>;
}

/** Tarjeta "Resumen" de la lista de bancos: saldos agrupados por tipo de cuenta. */
export function ResumenBancos({ resumen }: { resumen: ResumenBancosDatos }) {
  const total = resumen.bancoEfectivoCentavos + resumen.tarjetasCentavos;

  return (
    <Card className="gap-0 rounded-2xl">
      <CardHeader>
        <CardTitle className="text-[15px] font-medium">Resumen</CardTitle>
      </CardHeader>
      <CardContent className="flex h-full flex-col justify-between gap-4">
        <FilaResumen etiqueta="Saldo en bancos y efectivo" centavos={resumen.bancoEfectivoCentavos} />
        <div className="border-border border-t" />
        <FilaResumen etiqueta="Saldo en tarjetas de crédito" centavos={resumen.tarjetasCentavos} />
        <div className="border-border border-t" />
        <FilaResumen etiqueta="Saldo total" centavos={total} destacar />
      </CardContent>
    </Card>
  );
}
