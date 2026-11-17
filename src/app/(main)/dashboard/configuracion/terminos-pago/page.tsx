import { redirect } from "next/navigation";

import { ContenedorLista } from "@/components/listas/tabla-lista";
import { getRol } from "@/lib/auth/rol";
import { getTerminosPago } from "@/lib/configuracion/consultas";

import { EncabezadoConfiguracion } from "../_components/encabezado";
import { TerminosCliente } from "./_components/terminos-cliente";

export default async function Page() {
  const [rol, terminos] = await Promise.all([getRol(), getTerminosPago()]);
  if (rol == null) redirect("/unauthorized");

  return (
    <ContenedorLista>
      <EncabezadoConfiguracion
        titulo="Términos de pago"
        descripcion="Plazos disponibles para las facturas de venta (contado, 8, 15, 30 y 60 días)."
      />
      <TerminosCliente terminos={terminos} puedeCrear={rol === "admin" || rol === "contador"} />
    </ContenedorLista>
  );
}
