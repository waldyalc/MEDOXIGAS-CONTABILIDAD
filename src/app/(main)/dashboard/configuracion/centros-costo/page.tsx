import { redirect } from "next/navigation";

import { ContenedorLista } from "@/components/listas/tabla-lista";
import { getRol } from "@/lib/auth/rol";
import { getCentrosCosto } from "@/lib/centros-costo/consultas";

import { EncabezadoConfiguracion } from "../_components/encabezado";
import { CentrosCostoCliente } from "./_components/centros-costo-cliente";

export default async function Page() {
  const [rol, centros] = await Promise.all([getRol(), getCentrosCosto()]);
  if (rol == null) redirect("/unauthorized");

  return (
    <ContenedorLista>
      <EncabezadoConfiguracion
        titulo="Centros de costo"
        descripcion="Áreas o sucursales para separar ingresos y gastos en los documentos y el estado de resultados."
      />
      <CentrosCostoCliente centros={centros} puedeEditar={rol === "admin" || rol === "contador"} />
    </ContenedorLista>
  );
}
