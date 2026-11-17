import { redirect } from "next/navigation";

import { ContenedorLista } from "@/components/listas/tabla-lista";
import { getRol } from "@/lib/auth/rol";
import { getCuentasRetencion, getRetencionesConfig } from "@/lib/configuracion/consultas";

import { EncabezadoConfiguracion } from "../_components/encabezado";
import { RetencionesCliente } from "./_components/retenciones-cliente";

export default async function Page() {
  const [rol, retenciones, cuentas] = await Promise.all([getRol(), getRetencionesConfig(), getCuentasRetencion()]);
  if (rol == null) redirect("/unauthorized");

  return (
    <ContenedorLista>
      <EncabezadoConfiguracion
        titulo="Retenciones"
        descripcion="Retenciones de ITBIS e ISR que se pueden aplicar en pagos recibidos y pagos a proveedores."
      />
      <RetencionesCliente
        retenciones={retenciones}
        cuentas={cuentas}
        puedeEscribir={rol === "admin" || rol === "contador"}
      />
    </ContenedorLista>
  );
}
