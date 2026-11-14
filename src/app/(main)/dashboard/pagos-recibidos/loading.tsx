import { EsqueletoLista } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoLista
      titulo="Pagos recibidos"
      descripcion="Pagos de clientes aplicados a sus facturas."
      acciones={1}
      columnas={8}
    />
  );
}
