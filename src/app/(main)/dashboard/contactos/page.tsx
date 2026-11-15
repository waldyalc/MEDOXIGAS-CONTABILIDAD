import { redirect } from "next/navigation";

import { getRol } from "@/lib/auth/rol";
import { listarContactos } from "@/lib/contactos/consultas";
import { leerPestanaContactos } from "@/lib/contactos/contactos";
import { listarListasPreciosActivas } from "@/lib/inventario/consultas";
import { leerOpcionesLista, leerTexto, type ParametrosLista } from "@/lib/listas/parametros";

import { ContactosCliente } from "./_components/contactos-cliente";

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosLista> }) {
  const params = await searchParams;
  const opciones = leerOpcionesLista(params);
  const pestana = leerPestanaContactos(leerTexto(params, "tipo"));

  const [rol, contactos, listasPrecios] = await Promise.all([
    getRol(),
    listarContactos(opciones, pestana),
    listarListasPreciosActivas(),
  ]);
  if (rol === null) redirect("/unauthorized");

  return (
    <ContactosCliente
      contactos={contactos.filas}
      resumen={contactos.resumen}
      params={params}
      opciones={opciones}
      pestana={pestana}
      listasPrecios={listasPrecios}
      puedeEditar={rol !== "lector"}
    />
  );
}
