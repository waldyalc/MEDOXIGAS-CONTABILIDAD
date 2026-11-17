import { EsqueletoLista } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoLista
      titulo="Facturación"
      descripcion="Facturas de venta con comprobante fiscal (NCF)."
      grande
      acciones={1}
      columnas={8}
    />
  );
}
