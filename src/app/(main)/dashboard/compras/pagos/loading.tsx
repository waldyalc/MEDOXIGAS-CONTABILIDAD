import { EsqueletoLista } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoLista
      titulo="Pagos a proveedores"
      descripcion="Pagos aplicados a facturas de proveedor."
      acciones={1}
      columnas={8}
    />
  );
}
