import { redirect } from "next/navigation";

import { ContenedorLista } from "@/components/listas/tabla-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { getPerfil } from "@/lib/auth/rol";
import { getDatosBancos, getIngresosGastosMensual } from "@/lib/bancos/consultas";
import { hoyRD } from "@/lib/facturacion/formato";
import { centavos } from "@/lib/reportes/dinero";

import { AccionesBancos } from "./_components/acciones-bancos";
import { PanelBancos } from "./_components/panel-bancos";

export default async function Page() {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const [datos, serie] = await Promise.all([getDatosBancos(), getIngresosGastosMensual()]);

  const resumen = datos.cuentas.reduce(
    (total, cuenta) => {
      const saldo = centavos(cuenta.saldo);
      if (cuenta.tipoBanco === "tarjeta") total.tarjetasCentavos += saldo;
      else total.bancoEfectivoCentavos += saldo;
      return total;
    },
    { bancoEfectivoCentavos: 0, tarjetasCentavos: 0 },
  );

  return (
    <ContenedorLista>
      <EncabezadoPagina
        titulo="Bancos y cajas"
        subtitulo="Saldos de tus cuentas de caja y banco, transferencias y depósitos."
        migas={[{ etiqueta: "Inicio", href: "/dashboard" }, { etiqueta: "Bancos" }]}
        acciones={
          perfil.rol !== "lector" ? (
            <AccionesBancos
              cuentasCajaBanco={datos.cuentasCajaBanco}
              cuentasMovimiento={datos.cuentasMovimiento}
              fechaHoy={hoyRD()}
            />
          ) : undefined
        }
      />

      <PanelBancos cuentas={datos.cuentas} serie={serie} resumen={resumen} puedeEscribir={perfil.rol !== "lector"} />
    </ContenedorLista>
  );
}
