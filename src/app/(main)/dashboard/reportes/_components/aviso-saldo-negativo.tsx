import { TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { centavos } from "@/lib/reportes/dinero";
import { mensajeSaldoNegativo, obtenerSaldosCajaBanco } from "@/lib/reportes/saldos";

export async function AvisoSaldoNegativo() {
  const { filas, error } = await obtenerSaldosCajaBanco();
  if (error) return null;

  const cuentasNegativas = filas.filter((cuenta) => centavos(cuenta.saldo) < 0);
  if (cuentasNegativas.length === 0) return null;

  return (
    <Alert className="border-amber-500/60 bg-amber-50 text-amber-900 dark:border-amber-400/50 dark:bg-amber-950/40 dark:text-amber-100">
      <TriangleAlert />
      <AlertTitle>Saldo negativo en caja o banco</AlertTitle>
      <AlertDescription className="flex flex-col gap-1 text-amber-900 dark:text-amber-100">
        {cuentasNegativas.map((cuenta) => (
          <p key={cuenta.cuenta_id}>{mensajeSaldoNegativo(cuenta.nombre, centavos(cuenta.saldo))}</p>
        ))}
      </AlertDescription>
    </Alert>
  );
}
