import { notFound, redirect } from "next/navigation";

import { ContenedorDetalle } from "@/components/pagina/contenedor-pagina";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { getRol } from "@/lib/auth/rol";
import { formatoDia } from "@/lib/formato";
import { obtenerConteo } from "@/lib/inventario/ferreteria/consultas";

import { EtiquetaEstadoConteo } from "../_components/estado-conteo";
import { DetalleConteo } from "./_components/detalle-conteo";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const rol = await getRol();
  if (rol === null) redirect("/unauthorized");

  const conteo = await obtenerConteo(id);
  if (!conteo) notFound();

  const notas = conteo.notas?.trim() ?? "";

  return (
    <ContenedorDetalle>
      <EncabezadoPagina
        titulo={`Conteo físico #${conteo.numero}`}
        subtitulo={`${conteo.almacen_nombre} · ${formatoDia(conteo.fecha)}`}
        migas={[
          { etiqueta: "Inicio", href: "/dashboard" },
          { etiqueta: "Inventario", href: "/dashboard/inventario" },
          { etiqueta: "Conteos físicos", href: "/dashboard/inventario/conteos" },
          { etiqueta: `#${conteo.numero}` },
        ]}
        acciones={<EtiquetaEstadoConteo estado={conteo.estado} />}
      />

      {notas ? (
        <div className="border-border bg-card rounded-xl border px-4 py-3">
          <p className="text-muted-foreground text-xs font-medium">Notas</p>
          <p className="text-foreground mt-1 text-sm whitespace-pre-line">{notas}</p>
        </div>
      ) : null}

      <DetalleConteo conteo={conteo} puedeEscribir={rol !== "lector"} />
    </ContenedorDetalle>
  );
}
