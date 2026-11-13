import { redirect } from "next/navigation";

import { getRol } from "@/lib/auth/rol";
import { listarAlmacenes } from "@/lib/inventario/consultas";

import { AlmacenesCliente } from "./_components/almacenes-cliente";

export default async function Page() {
  const rol = await getRol();
  if (rol === null) redirect("/unauthorized");

  const almacenes = await listarAlmacenes();

  return <AlmacenesCliente almacenes={almacenes} puedeEditar={rol !== "lector"} />;
}
