import { redirect } from "next/navigation";

import { TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getPerfil } from "@/lib/auth/rol";
import { getDatosBancos } from "@/lib/bancos/consultas";
import { hoyRD } from "@/lib/facturacion/formato";
import { centavos } from "@/lib/reportes/dinero";
import { mensajeSaldoNegativo } from "@/lib/reportes/saldos";

import { PanelBancos } from "./_components/panel-bancos";

export default async function Page() {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const datos = await getDatosBancos();
  const negativas = datos.cuentas.filter((cuenta) => centavos(cuenta.saldo) < 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl tracking-tight">Bancos y caja</h1>
        <p className="text-muted-foreground text-sm">
          Saldos de tus cuentas de caja y banco, transferencias y depósitos.
        </p>
      </div>

      {negativas.length > 0 ? (
        <Alert className="border-amber-500/60 bg-amber-50 text-amber-900 dark:border-amber-400/50 dark:bg-amber-950/40 dark:text-amber-100">
          <TriangleAlert />
          <AlertTitle>Saldo negativo en caja o banco</AlertTitle>
          <AlertDescription className="flex flex-col gap-1 text-amber-900 dark:text-amber-100">
            {negativas.map((cuenta) => (
              <p key={cuenta.id}>{mensajeSaldoNegativo(cuenta.nombre, centavos(cuenta.saldo))}</p>
            ))}
          </AlertDescription>
        </Alert>
      ) : null}

      <PanelBancos
        cuentas={datos.cuentas}
        cuentasCajaBanco={datos.cuentasCajaBanco}
        cuentasMovimiento={datos.cuentasMovimiento}
        puedeEscribir={perfil.rol !== "lector"}
        fechaHoy={hoyRD()}
      />
    </div>
  );
}
