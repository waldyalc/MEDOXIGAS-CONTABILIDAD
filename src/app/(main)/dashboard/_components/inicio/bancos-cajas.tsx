import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { centavos, formatearRd } from "@/lib/reportes/dinero";
import type { SaldoCajaBanco } from "@/lib/reportes/saldos";

import { EstadoVacio } from "./estado-vacio";
import { TituloWidget } from "./titulo-widget";

interface Props {
  filas: readonly SaldoCajaBanco[];
  href: string;
}

/** Widget opcional «Bancos y cajas»: saldo actual de cada cuenta de efectivo. */
export function BancosCajas({ filas, href }: Props) {
  return (
    <Card className="ring-border h-full gap-0 rounded-2xl [--card-spacing:--spacing(6)]">
      <CardHeader className="flex flex-col gap-0.5">
        <TituloWidget titulo="Bancos y cajas" href={href} tooltip="Saldo actual de tus cuentas de banco y caja." />
        <p className="text-muted-foreground text-xs">Saldos al día de hoy.</p>
      </CardHeader>
      <CardContent>
        {filas.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-left text-[11px] font-medium tracking-wide uppercase">
                <th className="pb-2 font-medium">Cuenta</th>
                <th className="w-28 pb-2 text-right font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <tr key={fila.cuenta_id} className="border-border/60 border-t">
                  <td className="py-2.5 pr-2">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-medium">
                        {fila.codigo.slice(0, 2)}
                      </span>
                      <span className="truncate">{fila.nombre}</span>
                    </span>
                  </td>
                  <td className="py-2.5 text-right whitespace-nowrap tabular-nums">
                    {formatearRd(centavos(fila.saldo))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EstadoVacio
            className="min-h-56"
            titulo="Sin cuentas registradas"
            detalle="No tienes cuentas de banco o caja para mostrar."
          />
        )}
      </CardContent>
    </Card>
  );
}
