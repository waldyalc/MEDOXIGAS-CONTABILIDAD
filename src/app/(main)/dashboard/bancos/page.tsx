import { redirect } from "next/navigation";

import { ContenedorLista } from "@/components/listas/tabla-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
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
      <EncabezadoPagina
        titulo="Bancos y caja"
        subtitulo="Saldos de tus cuentas de caja y banco, transferencias y depósitos."
        migas={[{ etiqueta: "Inicio", href: "/dashboard" }, { etiqueta: "Bancos" }]}
      />

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
