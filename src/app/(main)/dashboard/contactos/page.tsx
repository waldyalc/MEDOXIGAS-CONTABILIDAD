import { redirect } from "next/navigation";

import { getRol } from "@/lib/auth/rol";
import { listarContactos } from "@/lib/contactos/consultas";
import { listarListasPreciosActivas } from "@/lib/inventario/consultas";

import { ContactosCliente } from "./_components/contactos-cliente";

export default async function Page() {
  const [rol, contactos, listasPrecios] = await Promise.all([
    getRol(),
    listarContactos(),
    listarListasPreciosActivas(),
  ]);
  if (rol === null) redirect("/unauthorized");

  return <ContactosCliente contactos={contactos} listasPrecios={listasPrecios} puedeEditar={rol !== "lector"} />;
}
