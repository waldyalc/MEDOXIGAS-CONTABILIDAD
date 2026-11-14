import { EsqueletoLista } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoLista
      titulo="Impuestos"
      descripcion="Tasas de ITBIS disponibles para los documentos."
      columnas={4}
      filas={5}
      acciones={0}
    />
  );
}
