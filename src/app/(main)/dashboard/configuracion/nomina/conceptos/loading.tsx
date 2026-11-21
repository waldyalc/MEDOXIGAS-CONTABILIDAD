import { EsqueletoLista } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoLista
      titulo="Conceptos"
      descripcion="Ingresos, deducciones, aportes patronales y provisiones."
      filtros={1}
      columnas={9}
      filas={8}
    />
  );
}
