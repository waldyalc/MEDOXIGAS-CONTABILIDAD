import { EsqueletoLista } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoLista
      titulo="Mapeo contable"
      descripcion="Cuentas de gasto y pasivo por segmento."
      columnas={4}
      filas={10}
    />
  );
}
