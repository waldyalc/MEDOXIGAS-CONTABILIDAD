import type { ReactNode } from "react";

import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";

export function EncabezadoConfiguracion({
  titulo,
  descripcion,
  acciones,
}: {
  readonly titulo: string;
  readonly descripcion: string;
  readonly acciones?: ReactNode;
}) {
  return (
    <EncabezadoPagina
      titulo={titulo}
      subtitulo={descripcion}
      migas={[
        { etiqueta: "Inicio", href: "/dashboard" },
        { etiqueta: "Configuración", href: "/dashboard/configuracion" },
        { etiqueta: titulo },
      ]}
      acciones={acciones}
    />
  );
}
