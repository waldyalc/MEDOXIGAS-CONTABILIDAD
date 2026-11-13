import { redirect } from "next/navigation";

import { getRol } from "@/lib/auth/rol";
import { getEmpresa } from "@/lib/facturacion/consultas";

import { EncabezadoConfiguracion } from "../_components/encabezado";
import { EmpresaForm } from "./_components/empresa-form";

export default async function Page() {
  const [rol, empresa] = await Promise.all([getRol(), getEmpresa()]);
  if (rol == null) redirect("/unauthorized");

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoConfiguracion
        titulo="Empresa"
        descripcion="Nombre, RNC, contacto y logo que salen en los documentos de venta."
      />
      <EmpresaForm empresa={empresa} puedeEditar={rol === "admin"} />
    </div>
  );
}
