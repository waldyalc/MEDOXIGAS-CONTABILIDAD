import { redirect } from "next/navigation";

import { ContenedorLista } from "@/components/listas/tabla-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { getRol } from "@/lib/auth/rol";
import { getNumeraciones } from "@/lib/numeraciones/consultas";

import { NumeracionesCliente } from "./_components/numeraciones-cliente";

export default async function Page() {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const numeraciones = await getNumeraciones();

  return (
    <ContenedorLista>
      <EncabezadoPagina
        titulo="Numeraciones"
        subtitulo="Secuencias del NCF por tipo de comprobante. El siguiente número se asigna al guardar cada documento."
        migas={[
          { etiqueta: "Inicio", href: "/dashboard" },
          { etiqueta: "Contabilidad", href: "/dashboard/contabilidad" },
          { etiqueta: "Numeraciones" },
        ]}
      />

      <NumeracionesCliente numeraciones={numeraciones} puedeEditar={rol !== "lector"} />
    </ContenedorLista>
  );
}
