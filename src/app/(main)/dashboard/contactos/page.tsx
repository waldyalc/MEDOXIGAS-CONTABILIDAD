import { redirect } from "next/navigation";

import { getRol } from "@/lib/auth/rol";
import { listarContactos } from "@/lib/contactos/consultas";

import { ContactosCliente } from "./_components/contactos-cliente";

export default async function Page() {
  const rol = await getRol();
  if (rol === null) redirect("/unauthorized");

  const contactos = await listarContactos();

  return <ContactosCliente contactos={contactos} puedeEditar={rol !== "lector"} />;
}
