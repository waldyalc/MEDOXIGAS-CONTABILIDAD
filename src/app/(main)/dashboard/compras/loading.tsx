import { EsqueletoLista } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoLista
      titulo="Compras"
      descripcion="Facturas de proveedores, cuentas por pagar y sus pagos."
      acciones={3}
      columnas={9}
    />
  );
}
