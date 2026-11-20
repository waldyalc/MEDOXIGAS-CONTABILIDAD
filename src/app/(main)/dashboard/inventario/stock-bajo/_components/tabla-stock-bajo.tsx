import { cn } from "cn";
import { PackageCheck } from "lucide-react";

import { type ColumnaLista, PillEstado, TablaLista } from "@/components/listas/tabla-lista";
import { formatoCantidad } from "@/lib/productos/productos";

import { clasificarStock, etiquetaSituacion, type FilaStockBajo, type SituacionStock } from "../_lib/stock-bajo";

const TONO_SITUACION: Record<SituacionStock, "peligro" | "pendiente" | "neutro"> = {
  critico: "peligro",
  bajo: "pendiente",
  "sin-stock": "neutro",
};

const COLUMNAS: readonly ColumnaLista<FilaStockBajo>[] = [
  {
    clave: "producto",
    encabezado: "Producto",
    className: "min-w-[220px]",
    celda: (fila) => {
      const codigo = fila.codigos[0];

      return (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{fila.nombre}</span>
          {codigo ? <span className="text-muted-foreground font-mono text-xs">{codigo}</span> : null}
        </div>
      );
    },
  },
  {
    clave: "referencia",
    encabezado: "Referencia",
    celda: (fila) => <span className="text-muted-foreground">{fila.referencia ?? "—"}</span>,
  },
  {
    clave: "marca",
    encabezado: "Marca",
    className: "hidden md:table-cell",
    celda: (fila) => fila.marca ?? "—",
  },
  {
    clave: "categoria",
    encabezado: "Categoría",
    className: "hidden lg:table-cell",
    celda: (fila) => fila.categoria ?? "—",
  },
  {
    clave: "situacion",
    encabezado: "Situación",
    celda: (fila) => {
      const situacion = clasificarStock(fila);
      return <PillEstado tono={TONO_SITUACION[situacion]}>{etiquetaSituacion(situacion)}</PillEstado>;
    },
  },
  {
    clave: "existencia",
    encabezado: "Existencia",
    alineacion: "derecha",
    celda: (fila) => (
      <span className={cn(clasificarStock(fila) === "critico" && "font-medium text-red-600 dark:text-red-400")}>
        {formatoCantidad(fila.cantidad)}
      </span>
    ),
  },
  {
    clave: "minimo",
    encabezado: "Mínimo",
    alineacion: "derecha",
    celda: (fila) => formatoCantidad(fila.minimo),
  },
  {
    clave: "maximo",
    encabezado: "Máximo",
    alineacion: "derecha",
    className: "hidden sm:table-cell",
    celda: (fila) => (fila.maximo === null ? "—" : formatoCantidad(fila.maximo)),
  },
  {
    clave: "sugerido",
    encabezado: "Sugerido",
    alineacion: "derecha",
    celda: (fila) => <span className="font-medium">{formatoCantidad(fila.sugerido)}</span>,
  },
  {
    clave: "ubicacion",
    encabezado: "Ubicación",
    className: "hidden md:table-cell",
    celda: (fila) => fila.ubicacion ?? "—",
  },
];

export function TablaStockBajo({ filas, buscando }: { filas: readonly FilaStockBajo[]; buscando: boolean }) {
  return (
    <TablaLista
      columnas={COLUMNAS}
      filas={filas}
      claveFila={(fila) => fila.producto_id}
      vacio={
        buscando
          ? {
              filtrada: true,
              titulo: "Sin resultados",
              descripcion: "Ningún producto del reporte coincide con la búsqueda.",
              icono: <PackageCheck className="size-10" />,
            }
          : {
              titulo: "Todo por encima del mínimo",
              descripcion: "No hay productos con existencia negativa ni por debajo de su mínimo en este almacén.",
              icono: <PackageCheck className="size-10" />,
            }
      }
    />
  );
}
