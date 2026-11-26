import type { ReactNode } from "react";

import { redirect } from "next/navigation";

import { getEmpresa } from "@/lib/facturacion/consultas";
import { getConsumidorFinalId } from "@/lib/pos/consultas";
import { contactoInicialPOS } from "@/lib/pos/consumidor-final";
import { createClient } from "@/lib/supabase/server";

import { BarraSuperiorPos } from "./_components/barra-superior-pos";
import { CarritoPosProvider } from "./_components/carrito-pos-provider";
import { EstadoPos } from "./_components/estado-pos";
import { MenuPos } from "./_components/menu-pos";
import { OfflinePosProvider } from "./_components/offline-pos-provider";
import { PosSpaProvider } from "./_components/pos-spa-provider";
import { PosSpaShell } from "./_components/pos-spa-shell";
import { getContextoPOS } from "./_components/servidor";

/**
 * Shell del POS: layout propio, sin el sidebar de Contabilidad. La navegación
 * vive en un riel lateral estilo Alegra (`MenuPos`): 52 px con iconos que
 * expande un panel de 271 px al hover/foco o fijado con el pin; en móvil es un
 * cajón con velo. El shell mide el viewport (`h-dvh`, sin scroll de página) y
 * solo scrollea el contenido de cada pantalla. Aquí viven la sesión, la
 * terminal activa (cookie `pos_terminal_id`), el turno del pie del menú y el
 * provider del carrito, que sobrevive a la navegación entre las pestañas.
 */
export const dynamic = "force-dynamic";

export default async function Layout({ children }: Readonly<{ children: ReactNode }>) {
  const contexto = await getContextoPOS();

  if (!contexto.perfil) redirect("/login");
  if (contexto.perfil.rol == null) redirect("/unauthorized");
  if (contexto.estado === "no-instalado") return <EstadoPos tipo="no-instalado" />;
  if (contexto.estado === "error") return <EstadoPos tipo="error" />;
  if (contexto.estado === "sin-terminales" || !contexto.terminal) return <EstadoPos tipo="sin-terminales" />;

  const [empresa, consumidorFinalId] = await Promise.all([getEmpresa(), getConsumidorFinalId()]);
  const terminal = contexto.terminal;
  const turno = contexto.turno;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims.sub) redirect("/login");

  return (
    <OfflinePosProvider
      key={`${data.claims.sub}/${terminal.id}`}
      ambito={`${data.claims.sub}/${terminal.id}`}
      terminalId={terminal.id}
      turnoId={turno?.id ?? null}
      logoUrl={empresa?.logo_url ?? null}
    >
      <CarritoPosProvider
        key={terminal.id}
        defaults={{
          contactoId: contactoInicialPOS(consumidorFinalId, terminal.contacto_defecto_id),
          listaPrecioId: terminal.lista_precio_defecto_id ?? "",
          numeracionId: terminal.numeracion_defecto_id,
        }}
      >
        <PosSpaProvider>
          <div className="bg-background flex h-dvh flex-col overflow-hidden [font-family:var(--font-inter)] [--ring:var(--pos-primario)] lg:flex-row">
            <MenuPos
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

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <BarraSuperiorPos />
              <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
                <PosSpaShell>{children}</PosSpaShell>
              </main>
            </div>
          </div>
        </PosSpaProvider>
      </CarritoPosProvider>
    </OfflinePosProvider>
  );
}
