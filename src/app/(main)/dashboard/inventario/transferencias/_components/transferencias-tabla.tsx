import Link from "next/link";

import { ArrowLeftRight, Plus } from "lucide-react";

import { Enlace } from "@/components/enlace";
import {
  type ColumnaLista,
  ContenedorLista,
  PillEstado,
  TablaLista,
  TarjetaLista,
} from "@/components/listas/tabla-lista";
import { Button } from "@/components/ui/button";
import { rutaTransferenciaInventario } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";
import type { TransferenciaLista } from "@/lib/inventario/tipos";

const columnas: readonly ColumnaLista<TransferenciaLista>[] = [
  {
    clave: "numero",
    encabezado: "Número",
    className: "w-20",
    celda: (transferencia) => (
      <Enlace href={rutaTransferenciaInventario(transferencia.id)}>{transferencia.numero}</Enlace>
    ),
  },
  {
    clave: "fecha",
    encabezado: "Fecha",
    celda: (transferencia) => formatoDia(transferencia.fecha),
  },
  {
    clave: "origen",
    encabezado: "Origen",
    celda: (transferencia) => transferencia.origen_nombre,
  },
  {
    clave: "destino",
    encabezado: "Destino",
    celda: (transferencia) => transferencia.destino_nombre,
  },
  {
    clave: "productos",
    encabezado: "Productos",
    alineacion: "derecha",
    celda: (transferencia) => transferencia.lineas,
  },
  {
    clave: "estado",
    encabezado: "Estado",
    celda: (transferencia) => (
      <PillEstado tono={transferencia.estado === "anulada" ? "peligro" : "exito"}>
        {transferencia.estado === "anulada" ? "Anulada" : "Activa"}
      </PillEstado>
    ),
  },
];

export function TransferenciasTabla({
  transferencias,
  puedeEscribir,
}: {
  transferencias: TransferenciaLista[];
  puedeEscribir: boolean;
}) {
  return (
    <ContenedorLista>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl tracking-tight">Transferencias entre almacenes</h1>
          <p className="text-muted-foreground text-sm">
            Mueven la existencia de un almacén a otro sin asiento contable.
          </p>
        </div>
        {puedeEscribir ? (
          <Button render={<Link href="/dashboard/inventario/transferencias/nueva" />}>
            <Plus />
            Nueva transferencia
          </Button>
        ) : null}
      </div>

      <TarjetaLista data-lista="inventario-transferencias">
        <TablaLista
          columnas={columnas}
          filas={transferencias}
          claveFila={(transferencia) => transferencia.id}
          filaHref={(transferencia) => rutaTransferenciaInventario(transferencia.id)}
          vacio={{
            titulo: "¡Aún no tienes transferencias!",
            descripcion: "Mueve existencia de un almacén a otro.",
            icono: <ArrowLeftRight className="size-10" />,
            accion: puedeEscribir ? (
              <Button render={<Link href="/dashboard/inventario/transferencias/nueva" />}>
                <Plus />
                Nueva transferencia
              </Button>
            ) : undefined,
          }}
        />
      </TarjetaLista>
    </ContenedorLista>
  );
}
