import Link from "next/link";
import { redirect } from "next/navigation";

import { ContenedorLista } from "@/components/pagina/contenedor-pagina";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";

import { getContextoPOS } from "../_components/servidor";

/**
 * Registro de pagos del POS (Ingresos → Registro de pagos). Placeholder de la
 * ruta para que el menú lateral no enlace a un 404: la pantalla completa con
 * Ingresos/Egresos, buscador, lista y detalle llega en la fase de Registro de
 * pagos (C6 del plan de rediseño).
 */
export default async function Page() {
  const contexto = await getContextoPOS();
  if (!contexto.perfil) redirect("/login");
  if (!contexto.terminal) return null;

  return (
    <ContenedorLista className="p-4 md:p-6">
      <EncabezadoPagina titulo="Registro de pagos" subtitulo="Ingresos y egresos de efectivo de esta terminal." />
      <div className="border-border bg-card text-muted-foreground rounded-lg border p-6 text-sm">
        Esta pantalla está en construcción. Por ahora, los movimientos de efectivo del turno se registran desde{" "}
        <Link className="text-primary font-medium hover:underline" href="/pos/turnos">
          Turnos
        </Link>
        .
      </div>
    </ContenedorLista>
  );
}
