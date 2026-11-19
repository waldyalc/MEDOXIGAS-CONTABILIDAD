import Link from "next/link";
import { redirect } from "next/navigation";

import { Scale } from "lucide-react";

import { Enlace } from "@/components/enlace";
import {
  type ColumnaLista,
  ContenedorLista,
  PillEstado,
  TablaLista,
  TarjetaLista,
} from "@/components/listas/tabla-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
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
      <EncabezadoPagina
        titulo="Conciliaciones"
        subtitulo="Compara los movimientos del sistema con el extracto del banco."
        migas={[
          { etiqueta: "Inicio", href: "/dashboard" },
          { etiqueta: "Bancos", href: "/dashboard/bancos" },
          { etiqueta: "Conciliaciones" },
        ]}
        acciones={
          puedeEscribir ? (
            <Button render={<Link href="/dashboard/bancos/conciliaciones/nueva" prefetch={false} />}>
              <Scale />
              Nueva conciliación
            </Button>
          ) : undefined
        }
      />

      <TarjetaLista data-lista="bancos-conciliaciones">
        <TablaLista
          columnas={columnas}
          filas={conciliaciones}
          claveFila={(conciliacion) => conciliacion.id}
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
