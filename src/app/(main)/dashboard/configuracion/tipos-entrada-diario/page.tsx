import { redirect } from "next/navigation";

import { ContenedorLista } from "@/components/listas/tabla-lista";
import { getRol } from "@/lib/auth/rol";
import { getTiposEntradaDiario } from "@/lib/tipos-entrada-diario/consultas";

import { EncabezadoConfiguracion } from "../_components/encabezado";
import { TiposEntradaCliente } from "./_components/tipos-entrada-cliente";

export default async function Page() {
  const [rol, tipos] = await Promise.all([getRol(), getTiposEntradaDiario()]);
  if (rol == null) redirect("/unauthorized");

  return (
    <ContenedorLista>
      <EncabezadoConfiguracion
        titulo="Tipos de entrada de diario"
        descripcion="Prefijos y numeraciones independientes que usan los asientos contables manuales."
      />
      <TiposEntradaCliente tipos={tipos} puedeEditar={rol === "admin" || rol === "contador"} />
    </ContenedorLista>
  );
}
