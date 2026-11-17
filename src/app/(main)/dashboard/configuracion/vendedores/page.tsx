import { redirect } from "next/navigation";

import { ContenedorLista } from "@/components/listas/tabla-lista";
import { getRol } from "@/lib/auth/rol";
import { getVendedores } from "@/lib/vendedores/consultas";

import { EncabezadoConfiguracion } from "../_components/encabezado";
import { VendedoresCliente } from "./_components/vendedores-cliente";

export default async function Page() {
  const [rol, vendedores] = await Promise.all([getRol(), getVendedores()]);
  if (rol == null) redirect("/unauthorized");

  return (
    <ContenedorLista>
      <EncabezadoConfiguracion
        titulo="Vendedores"
        descripcion="Personas que venden. Se pueden elegir en facturas, cotizaciones y conduces."
      />
      <VendedoresCliente vendedores={vendedores} puedeEditar={rol === "admin" || rol === "contador"} />
    </ContenedorLista>
  );
}
