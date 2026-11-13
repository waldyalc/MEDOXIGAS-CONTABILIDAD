import { redirect } from "next/navigation";

import { getRol } from "@/lib/auth/rol";
import { cargarOpcionesPagoRecurrente } from "@/lib/pagos-recurrentes/consultas";

import { FormularioPagoRecurrente } from "./_components/formulario-pago-recurrente";

export default async function Page() {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");
  if (rol === "lector") redirect("/dashboard/pagos-recurrentes");

  const opciones = await cargarOpcionesPagoRecurrente();

  return <FormularioPagoRecurrente {...opciones} />;
}
