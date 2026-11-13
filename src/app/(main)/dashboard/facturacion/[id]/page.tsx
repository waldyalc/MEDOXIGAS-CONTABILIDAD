import { notFound, redirect } from "next/navigation";

import { getPerfil } from "@/lib/auth/rol";
import { getFacturaVista } from "@/lib/facturacion/consultas";

import { AsientoContable } from "./_components/asiento-contable";
import { VistaFactura } from "./_components/vista-factura";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const { id } = await params;
  const datos = await getFacturaVista(id);
  if (!datos) notFound();

  return (
    <div className="flex flex-col gap-6 pb-10">
      <VistaFactura datos={datos} puedeEscribir={perfil.rol !== "lector"} />
      <div className="print:hidden">
        <AsientoContable asiento={datos.asiento} />
      </div>
    </div>
  );
}
