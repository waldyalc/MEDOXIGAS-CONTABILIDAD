import { EsqueletoLista } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoLista
      titulo="Cuentas"
      descripcion="Cuentas de caja y banco, saldos y movimientos."
      acciones={1}
      columnas={7}
    />
  );
}
