import Link from "next/link";
import { redirect } from "next/navigation";

import { CalendarClock, Plus } from "lucide-react";

import { Enlace } from "@/components/enlace";
import {
  type ColumnaLista,
  ContenedorLista,
  PillEstado,
  TablaLista,
  TarjetaLista,
} from "@/components/listas/tabla-lista";
import { Button } from "@/components/ui/button";
import { getRol } from "@/lib/auth/rol";
import { hoyEnRd } from "@/lib/compras/fechas";
import { formatoMoneda } from "@/lib/compras/formato";
import { rutaContacto, rutaCuenta, rutaPagoRecurrente } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";
import { listarPagosRecurrentes } from "@/lib/pagos-recurrentes/consultas";
import { siguientePeriodo } from "@/lib/pagos-recurrentes/periodos";
import type { PagoRecurrenteLista } from "@/lib/pagos-recurrentes/tipos";

import { BotonGenerar } from "./_components/boton-generar";

function proximoPeriodo(plan: PagoRecurrenteLista, hoy: string): string | null {
  return siguientePeriodo(
    {
      fechaInicio: plan.fecha_inicio,
      frecuenciaMeses: plan.frecuencia_meses,
      vigenciaHasta: plan.vigencia_hasta,
    },
    hoy,
  );
}

function columnasPagos(hoy: string): readonly ColumnaLista<PagoRecurrenteLista>[] {
  return [
    {
      clave: "nombre",
      encabezado: "Nombre",
      celda: (plan) => <Enlace href={rutaPagoRecurrente(plan.id)}>{plan.nombre}</Enlace>,
    },
    {
      clave: "contacto",
      encabezado: "Contacto",
      celda: (plan) =>
        plan.contacto_id ? (
          <Enlace href={rutaContacto(plan.contacto_id)}>{plan.contacto_nombre ?? "—"}</Enlace>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      clave: "cuentaGasto",
      encabezado: "Cuenta de gasto",
      celda: (plan) => <Enlace href={rutaCuenta(plan.cuenta_gasto_id)}>{plan.cuenta_gasto_nombre}</Enlace>,
    },
    {
      clave: "cuentaPago",
      encabezado: "Cuenta de pago",
      celda: (plan) => <Enlace href={rutaCuenta(plan.cuenta_pago_id)}>{plan.cuenta_pago_nombre}</Enlace>,
    },
    {
      clave: "frecuencia",
      encabezado: "Frecuencia",
      celda: (plan) => (plan.frecuencia_meses === 1 ? "Mensual" : `Cada ${plan.frecuencia_meses} meses`),
    },
    {
      clave: "proximo",
      encabezado: "Próximo periodo",
      celda: (plan) => {
        const proximo = proximoPeriodo(plan, hoy);
        return proximo ? formatoDia(proximo) : "—";
      },
    },
    {
      clave: "monto",
      encabezado: "Monto",
      alineacion: "derecha",
      celda: (plan) => formatoMoneda(plan.subtotal),
    },
    {
      clave: "estado",
      encabezado: "Estado",
      celda: (plan) => (
        <PillEstado tono={plan.activo ? "exito" : "neutro"}>{plan.activo ? "Activa" : "Inactiva"}</PillEstado>
      ),
    },
  ];
}

export default async function Page() {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const [planes, hoy] = [await listarPagosRecurrentes(), hoyEnRd()];
  const puedeEscribir = rol !== "lector";

  return (
    <ContenedorLista>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Pagos recurrentes</h1>
          <p className="text-muted-foreground text-sm">
            Plantillas de gastos fijos (alquiler, luz, internet). Genera el gasto menor de cada periodo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/dashboard/compras" prefetch={false} />}>
            Compras
          </Button>
          {puedeEscribir ? (
            <Button render={<Link href="/dashboard/pagos-recurrentes/nueva" prefetch={false} />}>
              <Plus data-icon="inline-start" />
              Nueva plantilla
            </Button>
          ) : null}
        </div>
      </div>

      <TarjetaLista data-lista="pagos-recurrentes">
        <TablaLista
          columnas={columnasPagos(hoy)}
          filas={planes}
          claveFila={(plan) => plan.id}
          filaHref={(plan) => rutaPagoRecurrente(plan.id)}
          acciones={puedeEscribir ? (plan) => <BotonGenerar planId={plan.id} activo={plan.activo} /> : undefined}
          vacio={{
            titulo: "¡Aún no tienes pagos recurrentes!",
            descripcion: "Crea una plantilla para generar el gasto de cada periodo.",
            icono: <CalendarClock className="size-10" />,
            accion: puedeEscribir ? (
              <Button render={<Link href="/dashboard/pagos-recurrentes/nueva" prefetch={false} />}>
                <Plus />
                Nueva plantilla
              </Button>
            ) : undefined,
          }}
        />
      </TarjetaLista>
    </ContenedorLista>
  );
}
