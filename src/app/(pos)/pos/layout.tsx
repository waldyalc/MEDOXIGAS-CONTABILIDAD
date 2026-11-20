import type { ReactNode } from "react";

import { redirect } from "next/navigation";

import { getEmpresa } from "@/lib/facturacion/consultas";

import { CarritoPosProvider } from "./_components/carrito-pos-provider";
import { EncabezadoPos } from "./_components/encabezado-pos";
import { EstadoPos } from "./_components/estado-pos";
import { getContextoPOS } from "./_components/servidor";

/**
 * Shell del POS: layout propio, sin el sidebar de Contabilidad. Aquí viven la
 * sesión, la terminal activa (cookie `pos_terminal_id`), el turno del header y
 * el provider del carrito, que sobrevive a la navegación entre las pestañas.
 */
export const dynamic = "force-dynamic";

export default async function Layout({ children }: Readonly<{ children: ReactNode }>) {
  const contexto = await getContextoPOS();

  if (!contexto.perfil) redirect("/login");
  if (contexto.perfil.rol == null) redirect("/unauthorized");
  if (contexto.estado === "no-instalado") return <EstadoPos tipo="no-instalado" />;
  if (contexto.estado === "error") return <EstadoPos tipo="error" />;
  if (contexto.estado === "sin-terminales" || !contexto.terminal) return <EstadoPos tipo="sin-terminales" />;

  const empresa = await getEmpresa();
  const terminal = contexto.terminal;
  const turno = contexto.turno;

  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <EncabezadoPos
        empresa={{ nombre: empresa?.nombre ?? null, logo_url: empresa?.logo_url ?? null }}
        terminales={contexto.terminales
          .filter((candidata) => candidata.activa)
          .map((candidata) => ({ id: candidata.id, nombre: candidata.nombre }))}
        terminal={{ id: terminal.id, nombre: terminal.nombre }}
        turno={
          turno
            ? {
                numero: turno.numero,
                estado: turno.estado,
                abierto_en: turno.abierto_en,
              }
            : null
        }
        usuario={{ nombre: contexto.perfil.nombre, correo: contexto.perfil.correo }}
      />

      <CarritoPosProvider
        key={terminal.id}
        defaults={{
          contactoId: terminal.contacto_defecto_id,
          listaPrecioId: terminal.lista_precio_defecto_id ?? "",
          numeracionId: terminal.numeracion_defecto_id,
        }}
      >
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      </CarritoPosProvider>
    </div>
  );
}
