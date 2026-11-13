import { redirect } from "next/navigation";

import { getRol } from "@/lib/auth/rol";
import { getVendedores } from "@/lib/vendedores/consultas";

import { EncabezadoConfiguracion } from "../_components/encabezado";
import { VendedoresCliente } from "./_components/vendedores-cliente";

export default async function Page() {
  const [rol, vendedores] = await Promise.all([getRol(), getVendedores()]);
  if (rol == null) redirect("/unauthorized");

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoConfiguracion
        titulo="Vendedores"
        descripcion="Personas que venden. Se pueden elegir en facturas, cotizaciones y conduces."
      />
      <VendedoresCliente vendedores={vendedores} puedeEditar={rol === "admin" || rol === "contador"} />
    </div>
  );
}
