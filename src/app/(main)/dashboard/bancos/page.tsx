import { redirect } from "next/navigation";

import { ContenedorLista } from "@/components/listas/tabla-lista";
import { getPerfil } from "@/lib/auth/rol";
import { getDatosBancos } from "@/lib/bancos/consultas";
import { hoyRD } from "@/lib/facturacion/formato";

import { PanelBancos } from "./_components/panel-bancos";

export default async function Page() {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const datos = await getDatosBancos();

  return (
    <ContenedorLista>
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl tracking-tight">Bancos y caja</h1>
        <p className="text-muted-foreground text-sm">
          Saldos de tus cuentas de caja y banco, transferencias y depósitos.
        </p>
      </div>

      <PanelBancos
        cuentas={datos.cuentas}
        cuentasCajaBanco={datos.cuentasCajaBanco}
        cuentasMovimiento={datos.cuentasMovimiento}
        puedeEscribir={perfil.rol !== "lector"}
        fechaHoy={hoyRD()}
      />
    </ContenedorLista>
  );
}
