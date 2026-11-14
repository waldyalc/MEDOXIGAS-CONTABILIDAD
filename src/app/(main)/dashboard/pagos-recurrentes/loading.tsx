import { EsqueletoLista } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoLista
      titulo="Pagos recurrentes"
      descripcion="Plantillas que generan gastos por período."
      acciones={1}
      columnas={8}
    />
  );
}
