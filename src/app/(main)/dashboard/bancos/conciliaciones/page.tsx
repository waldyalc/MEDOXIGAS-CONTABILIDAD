import Link from "next/link";
import { redirect } from "next/navigation";

import { ArrowLeft, Scale } from "lucide-react";

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
import { type ConciliacionLista, getListaConciliaciones } from "@/lib/bancos/conciliaciones";
import { rutaAsiento, rutaBanco, rutaConciliacion } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";
import { formatearRd } from "@/lib/reportes/dinero";

const columnas: readonly ColumnaLista<ConciliacionLista>[] = [
  {
    clave: "cuenta",
    encabezado: "Cuenta",
    celda: (conciliacion) => (
      <span className="inline-flex items-baseline gap-2">
        <Enlace href={rutaConciliacion(conciliacion.id)} className="font-medium">
          {conciliacion.cuentaNombre}
        </Enlace>
        <Enlace
          href={rutaBanco(conciliacion.cuentaId)}
          className="text-muted-foreground text-xs no-underline hover:underline"
        >
          Ver cuenta
        </Enlace>
      </span>
    ),
  },
  {
    clave: "periodo",
    encabezado: "Período",
    celda: (conciliacion) => (
      <span className="tabular-nums">
        {formatoDia(conciliacion.fechaDesde)} — {formatoDia(conciliacion.fechaHasta)}
      </span>
    ),
  },
  {
    clave: "saldo",
    encabezado: "Saldo del extracto",
    alineacion: "derecha",
    celda: (conciliacion) => (conciliacion.saldoCentavos === null ? "—" : formatearRd(conciliacion.saldoCentavos)),
  },
  {
    clave: "estado",
    encabezado: "Estado",
    celda: (conciliacion) => (
      <PillEstado tono={conciliacion.estado === "conciliada" ? "exito" : "pendiente"}>
        {conciliacion.estado === "conciliada" ? "Conciliada" : "Borrador"}
      </PillEstado>
    ),
  },
  {
    clave: "asiento",
    encabezado: "Asiento",
    celda: (conciliacion) =>
      conciliacion.asientoId ? (
        <Enlace href={rutaAsiento(conciliacion.asientoId)}>Ver asiento</Enlace>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
];

export default async function Page() {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const conciliaciones = await getListaConciliaciones();
  const puedeEscribir = rol !== "lector";

  return (
    <ContenedorLista>
      <div className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/dashboard/bancos" prefetch={false} />}>
          <ArrowLeft data-icon="inline-start" />
          Bancos
        </Button>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl tracking-tight">Conciliaciones</h1>
            <p className="text-muted-foreground text-sm">
              Compara los movimientos del sistema con el extracto del banco.
            </p>
          </div>
          {puedeEscribir ? (
            <Button render={<Link href="/dashboard/bancos/conciliaciones/nueva" prefetch={false} />}>
              <Scale />
              Nueva conciliación
            </Button>
          ) : null}
        </div>
      </div>

      <TarjetaLista data-lista="bancos-conciliaciones">
        <TablaLista
          columnas={columnas}
          filas={conciliaciones}
          claveFila={(conciliacion) => conciliacion.id}
          filaHref={(conciliacion) => rutaConciliacion(conciliacion.id)}
          vacio={{
            titulo: "¡Aún no tienes conciliaciones!",
            descripcion: "Crea la primera para comparar el sistema con el banco.",
            accion: puedeEscribir ? (
              <Button render={<Link href="/dashboard/bancos/conciliaciones/nueva" prefetch={false} />}>
                <Scale />
                Nueva conciliación
              </Button>
            ) : undefined,
          }}
        />
      </TarjetaLista>
    </ContenedorLista>
  );
}
