import type { ReactNode } from "react";

import { ContenedorLista } from "@/components/listas/tabla-lista";
import { ContenedorFormulario } from "@/components/pagina/contenedor-pagina";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";

import { TabsNomina } from "./tabs-nomina";

interface MarcoNominaProps {
  pagina: string;
  descripcion: string;
  tipo?: "formulario" | "lista";
  acciones?: ReactNode;
  aviso?: ReactNode;
  children: ReactNode;
}

/**
 * Marco común de las 4 subpáginas: `EncabezadoPagina` con migas
 * Inicio / Configuración / Nómina / {Página} y las pestañas compartidas.
 */
export function MarcoNomina({ pagina, descripcion, tipo = "formulario", acciones, aviso, children }: MarcoNominaProps) {
  const contenido = (
    <>
      <EncabezadoPagina
        titulo={pagina}
        subtitulo={descripcion}
        migas={[
          { etiqueta: "Inicio", href: "/dashboard" },
          { etiqueta: "Configuración", href: "/dashboard/configuracion" },
          { etiqueta: "Nómina" },
          { etiqueta: pagina },
        ]}
        acciones={acciones}
      />
      <TabsNomina />
      {aviso}
      {children}
    </>
  );

  return tipo === "lista" ? (
    <ContenedorLista>{contenido}</ContenedorLista>
  ) : (
    <ContenedorFormulario>{contenido}</ContenedorFormulario>
  );
}
