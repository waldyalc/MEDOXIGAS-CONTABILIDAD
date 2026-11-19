import Link from "next/link";

import { Plus, SlidersHorizontal } from "lucide-react";

import { Enlace } from "@/components/enlace";
import {
  type ColumnaLista,
  ContenedorLista,
  PillEstado,
  TablaLista,
  TarjetaLista,
} from "@/components/listas/tabla-lista";
import { Button } from "@/components/ui/button";
import { rutaAjusteInventario } from "@/lib/enlaces";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";
import type { AjusteLista } from "@/lib/inventario/tipos";

const columnas: readonly ColumnaLista<AjusteLista>[] = [
  {
    clave: "numero",
    encabezado: "Número",
    className: "w-20",
    celda: (ajuste) => <Enlace href={rutaAjusteInventario(ajuste.id)}>{ajuste.numero}</Enlace>,
  },
  {
    clave: "fecha",
    encabezado: "Fecha",
    celda: (ajuste) => formatoDia(ajuste.fecha),
  },
  {
    clave: "almacen",
    encabezado: "Almacén",
    celda: (ajuste) => ajuste.almacen_nombre,
  },
  {
    clave: "total",
    encabezado: "Total ajustado",
    alineacion: "derecha",
    celda: (ajuste) => formatoMoneda(ajuste.total),
  },
  {
    clave: "estado",
    encabezado: "Estado",
    celda: (ajuste) => (
      <PillEstado tono={ajuste.estado === "anulada" ? "peligro" : "exito"}>
        {ajuste.estado === "anulada" ? "Anulado" : "Activo"}
      </PillEstado>
    ),
  },
  {
    clave: "observaciones",
    encabezado: "Observaciones",
    celda: (ajuste) => (
      <span className="text-muted-foreground block max-w-[360px] truncate">{ajuste.observaciones?.trim() || "—"}</span>
    ),
  },
];

export function AjustesTabla({ ajustes, puedeEscribir }: { ajustes: AjusteLista[]; puedeEscribir: boolean }) {
  return (
    <ContenedorLista>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl tracking-tight">Ajustes de inventario</h1>
          <p className="text-muted-foreground text-sm">
            Entradas y salidas de productos con su asiento contable automático.
          </p>
        </div>
        {puedeEscribir ? (
          <Button render={<Link href="/dashboard/inventario/ajustes/nuevo" />}>
            <Plus />
            Nuevo ajuste
          </Button>
        ) : null}
      </div>

      <TarjetaLista data-lista="inventario-ajustes">
        <TablaLista
          columnas={columnas}
          filas={ajustes}
          claveFila={(ajuste) => ajuste.id}
          filaHref={(ajuste) => rutaAjusteInventario(ajuste.id)}
          vacio={{
            titulo: "¡Aún no tienes ajustes de inventario!",
            descripcion: "Registra la primera entrada o salida de productos.",
            icono: <SlidersHorizontal className="size-10" />,
            accion: puedeEscribir ? (
              <Button render={<Link href="/dashboard/inventario/ajustes/nuevo" />}>
                <Plus />
                Nuevo ajuste
              </Button>
            ) : undefined,
          }}
        />
      </TarjetaLista>
    </ContenedorLista>
  );
}
