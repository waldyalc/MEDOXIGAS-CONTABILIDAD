import Link from "next/link";

import { cn } from "cn";
import { ClipboardList, Plus } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { type ColumnaLista, TablaLista } from "@/components/listas/tabla-lista";
import { Button } from "@/components/ui/button";
import { formatoDia } from "@/lib/formato";

import type { ConteoLista } from "./datos-conteos";
import { EtiquetaEstadoConteo } from "./estado-conteo";
import { claseDiferencia, textoDiferencia } from "./tipos-conteo";

const RUTA = "/dashboard/inventario/conteos";

function DiferenciaTotal({ centavos }: { centavos: number }) {
  return <span className={cn("font-medium", claseDiferencia(centavos))}>{textoDiferencia(centavos)}</span>;
}

const columnas: readonly ColumnaLista<ConteoLista>[] = [
  {
    clave: "numero",
    encabezado: "Número",
    className: "w-24",
    celda: (conteo) => <Enlace href={`${RUTA}/${conteo.id}`}>#{conteo.numero}</Enlace>,
  },
  {
    clave: "almacen",
    encabezado: "Almacén",
    celda: (conteo) => conteo.almacen_nombre,
  },
  {
    clave: "fecha",
    encabezado: "Fecha",
    celda: (conteo) => formatoDia(conteo.fecha),
  },
  {
    clave: "estado",
    encabezado: "Estado",
    celda: (conteo) => <EtiquetaEstadoConteo estado={conteo.estado} />,
  },
  {
    clave: "diferencia",
    encabezado: "Diferencia total",
    alineacion: "derecha",
    celda: (conteo) => <DiferenciaTotal centavos={conteo.diferencia_total_centavos} />,
  },
  {
    clave: "creado_por",
    encabezado: "Creado por",
    celda: (conteo) => (
      <span className="text-muted-foreground block max-w-[200px] truncate">
        {conteo.creado_por_nombre?.trim() || "—"}
      </span>
    ),
  },
];

export function ConteosTabla({ conteos, puedeEscribir }: { conteos: ConteoLista[]; puedeEscribir: boolean }) {
  return (
    <TablaLista
      columnas={columnas}
      filas={conteos}
      claveFila={(conteo) => conteo.id}
      filaHref={(conteo) => `${RUTA}/${conteo.id}`}
      vacio={{
        titulo: "¡Aún no tienes conteos físicos!",
        descripcion: "Crea un conteo, registra lo que hay en el almacén y genera el ajuste con su asiento.",
        icono: <ClipboardList className="size-10" />,
        accion: puedeEscribir ? (
          <Button render={<Link href={`${RUTA}/nuevo`} />}>
            <Plus />
            Nuevo conteo
          </Button>
        ) : undefined,
      }}
    />
  );
}
