import { redirect } from "next/navigation";

import { ContenedorLista } from "@/components/listas/tabla-lista";
import { getRol } from "@/lib/auth/rol";
import { getCuentasDgii } from "@/lib/configuracion/dgii-consultas";

import { EncabezadoConfiguracion } from "../_components/encabezado";
import { ReportesDgiiCliente } from "./_components/reportes-dgii-cliente";

export default async function Page() {
  const [rol, cuentas] = await Promise.all([getRol(), getCuentasDgii()]);
  if (rol == null) redirect("/unauthorized");
  if (rol !== "admin" && rol !== "contador") redirect("/unauthorized");

  return (
    <ContenedorLista>
      <EncabezadoConfiguracion
        titulo="Reportes DGII"
        descripcion="Clasificación fiscal por cuenta contable para los reportes 606 y 607 (categoría DGII, tipo de compra y tipo de ingreso)."
      />
      <ReportesDgiiCliente cuentas={cuentas} puedeEditar />
    </ContenedorLista>
  );
}
