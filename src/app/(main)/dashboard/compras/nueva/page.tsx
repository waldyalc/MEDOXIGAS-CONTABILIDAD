import { redirect } from "next/navigation";

import { getRol } from "@/lib/auth/rol";
import { cargarOpcionesFactura } from "@/lib/compras/consultas";

import { FormularioFactura } from "../_components/formulario-factura";

export default async function Page() {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");
  if (rol === "lector") redirect("/dashboard/compras");

  const opciones = await cargarOpcionesFactura();

  return <FormularioFactura {...opciones} />;
}
