import { EsqueletoLista } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoLista
      titulo="Stock bajo"
      descripcion="Productos por debajo de su mínimo, del más crítico al menos."
      acciones={0}
      filtros={1}
      tarjetas={3}
      columnas={10}
      filas={8}
    />
  );
}
