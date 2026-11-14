import { EsqueletoLista } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoLista
      titulo="Notas de crédito"
      descripcion="Notas de crédito de venta ligadas a sus facturas."
      acciones={1}
      columnas={8}
    />
  );
}
