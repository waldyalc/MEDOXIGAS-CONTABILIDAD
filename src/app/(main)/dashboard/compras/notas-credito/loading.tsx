import { EsqueletoLista } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoLista
      titulo="Notas de crédito en compras"
      descripcion="Devoluciones y descuentos de proveedores."
      acciones={1}
      columnas={8}
    />
  );
}
