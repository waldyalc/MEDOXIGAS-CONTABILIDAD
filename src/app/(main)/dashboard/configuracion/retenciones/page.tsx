import { redirect } from "next/navigation";

import { getRol } from "@/lib/auth/rol";
import { getCuentasRetencion, getRetencionesConfig } from "@/lib/configuracion/consultas";

import { EncabezadoConfiguracion } from "../_components/encabezado";
import { RetencionesCliente } from "./_components/retenciones-cliente";

export default async function Page() {
  const [rol, retenciones, cuentas] = await Promise.all([getRol(), getRetencionesConfig(), getCuentasRetencion()]);
  if (rol == null) redirect("/unauthorized");

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoConfiguracion
        titulo="Retenciones"
        descripcion="Retenciones de ITBIS e ISR que se pueden aplicar en pagos recibidos y pagos a proveedores."
      />
      <RetencionesCliente
        retenciones={retenciones}
        cuentas={cuentas}
        puedeEscribir={rol === "admin" || rol === "contador"}
      />
    </div>
  );
}
