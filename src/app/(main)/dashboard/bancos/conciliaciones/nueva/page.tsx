import Link from "next/link";
import { redirect } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getRol } from "@/lib/auth/rol";
import { getDatosNuevaConciliacion } from "@/lib/bancos/conciliaciones";
import { hoyRD } from "@/lib/facturacion/formato";

import { FormNuevaConciliacion } from "./_components/form-nueva-conciliacion";

export default async function Page({ searchParams }: { searchParams: Promise<{ cuenta?: string }> }) {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const busqueda = await searchParams;
  const datos = await getDatosNuevaConciliacion();
  const cuentaInicial = datos.cuentas.find((cuenta) => cuenta.id === busqueda.cuenta)?.id ?? datos.cuentas[0]?.id ?? "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          render={<Link href="/dashboard/bancos/conciliaciones" prefetch={false} />}
        >
          <ArrowLeft data-icon="inline-start" />
          Conciliaciones
        </Button>
        <h1 className="text-3xl tracking-tight">Nueva conciliación</h1>
        <p className="text-muted-foreground text-sm">
          Elige la cuenta, la fecha de corte y el saldo que aparece en el extracto del banco.
        </p>
      </div>

      {datos.cuentas.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No hay cuentas de caja o banco activas. Crea una desde{" "}
          <Link href="/dashboard/bancos" className="text-primary underline-offset-4 hover:underline">
            Bancos
          </Link>
          .
        </p>
      ) : (
        <FormNuevaConciliacion
          cuentas={datos.cuentas}
          borradores={datos.borradores}
          cuentaInicial={cuentaInicial}
          fechaHoy={hoyRD()}
        />
      )}
    </div>
  );
}
